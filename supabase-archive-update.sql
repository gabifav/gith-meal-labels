-- Run once in Supabase SQL Editor to enable archive rules and activity history.
create table if not exists public.gith_activity (
 id bigint generated always as identity primary key,
 workspace_id uuid not null references public.gith_workspaces on delete cascade,
 entry_id uuid not null, actor_id uuid, action text not null,
 meal_name text not null, before_data jsonb, after_data jsonb,
 created_at timestamptz not null default now()
);
alter table public.gith_activity enable row level security;
revoke all on public.gith_activity from anon,authenticated;
grant select on public.gith_activity to authenticated;
drop policy if exists activity_read on public.gith_activity;
create policy activity_read on public.gith_activity for select to authenticated using(public.gith_member(workspace_id));
create or replace function public.gith_check_archive() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if (TG_OP='INSERT' and coalesce(new.data->>'archived','false')='true')
 or (TG_OP='UPDATE' and coalesce(new.data->>'archived','false') is distinct from coalesce(old.data->>'archived','false')) then
  if not public.gith_admin(new.workspace_id) then raise exception 'Only admins can archive or restore entries'; end if;
 end if;
 return new;
end $$;
create or replace function public.gith_record_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare action_name text; item_name text; w uuid; entry uuid; old_data jsonb; new_data jsonb;
begin
 if TG_OP='INSERT' then
 action_name:='Submitted'; item_name:=new.data->>'meal';w:=new.workspace_id;entry:=new.id;new_data:=new.data-'photo';
 elsif TG_OP='DELETE' then
 action_name:='Removed';item_name:=old.data->>'meal';w:=old.workspace_id;entry:=old.id;old_data:=old.data-'photo';
 else
 item_name:=new.data->>'meal';w:=new.workspace_id;entry:=new.id;old_data:=old.data-'photo';new_data:=new.data-'photo';
 if coalesce(new.data->>'archived','false') is distinct from coalesce(old.data->>'archived','false') then
 action_name:=case when new.data->>'archived'='true' then 'Archived' else 'Restored' end;
 elsif coalesce(new.data->>'arrived','false') is distinct from coalesce(old.data->>'arrived','false') then
 action_name:=case when new.data->>'arrived'='true' then 'Marked arrived' else 'Arrival unchecked' end;
 else action_name:='Edited';end if;
 end if;
 insert into public.gith_activity(workspace_id,entry_id,actor_id,action,meal_name,before_data,after_data)
 values(w,entry,auth.uid(),action_name,coalesce(item_name,'Meal'),old_data,new_data);
 return null;
end $$;
revoke execute on function public.gith_check_archive(),public.gith_record_activity() from public,anon,authenticated;
drop trigger if exists check_archive on public.gith_entries;
create trigger check_archive before insert or update on public.gith_entries for each row execute function public.gith_check_archive();
drop trigger if exists record_activity on public.gith_entries;
create trigger record_activity after insert or update or delete on public.gith_entries for each row execute function public.gith_record_activity();
create index if not exists gith_activity_workspace_time on public.gith_activity(workspace_id,created_at desc);
