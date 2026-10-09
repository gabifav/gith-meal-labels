-- Run once in Supabase SQL Editor. All access is restricted to workspace members.
create table public.gith_workspaces(id uuid primary key default gen_random_uuid(), name text not null);
create table public.gith_devices(workspace_id uuid references public.gith_workspaces on delete cascade, user_id uuid references auth.users, label text not null, role text not null check(role in ('admin','editor')), primary key(workspace_id,user_id));
create table public.gith_invites(token uuid primary key default gen_random_uuid(), workspace_id uuid references public.gith_workspaces on delete cascade, expires_at timestamptz not null default now()+interval '15 minutes');
create table public.gith_entries(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.gith_workspaces on delete cascade, owner_id uuid not null references auth.users, kind text not null check(kind in ('meal','photo','cook')), day text not null check(day in ('tue','fri','all')), data jsonb not null, version integer not null default 1);
alter table public.gith_workspaces enable row level security;
alter table public.gith_devices enable row level security;
alter table public.gith_invites enable row level security;
alter table public.gith_entries enable row level security;
create function public.gith_member(w uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from gith_devices where workspace_id=w and user_id=auth.uid()) $$;
create function public.gith_admin(w uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from gith_devices where workspace_id=w and user_id=auth.uid() and role='admin') $$;
create policy workspace_read on public.gith_workspaces for select to authenticated using(public.gith_member(id));
create policy device_read on public.gith_devices for select to authenticated using(public.gith_member(workspace_id));
create policy entry_read on public.gith_entries for select to authenticated using(public.gith_member(workspace_id));
-- Writes only through checked RPCs; clients cannot alter ownership or grant roles.
revoke all on public.gith_entries,public.gith_devices,public.gith_invites,public.gith_workspaces from anon,authenticated;
grant select on public.gith_entries,public.gith_devices,public.gith_workspaces to authenticated;
create function public.gith_create_workspace(workspace_name text, device_label text) returns uuid language plpgsql security definer set search_path=public as $$ declare w uuid; begin
if auth.uid() is null then raise exception 'Sign in first'; end if;
if length(trim(workspace_name)) not between 1 and 120 or length(trim(device_label)) not between 1 and 120 then raise exception 'Enter workspace and device names'; end if;
insert into gith_workspaces(name) values(trim(workspace_name)) returning id into w;
insert into gith_devices values(w,auth.uid(),trim(device_label),'admin');return w;end $$;
create function public.gith_make_invite(w uuid) returns uuid language plpgsql security definer set search_path=public as $$ declare t uuid;begin
if not gith_admin(w) then raise exception 'Admin access required';end if;
insert into gith_invites(workspace_id) values(w) returning token into t;return t;end $$;
create function public.gith_join_workspace(invite_token uuid, device_label text) returns uuid language plpgsql security definer set search_path=public as $$ declare w uuid;begin
if auth.uid() is null then raise exception 'Sign in first';end if;
if length(trim(device_label)) not between 1 and 120 then raise exception 'Enter a device name';end if;
delete from gith_invites where token=invite_token and expires_at>now() returning workspace_id into w;
if w is null then raise exception 'Invitation expired or already used';end if;
insert into gith_devices values(w,auth.uid(),trim(device_label),'editor') on conflict do nothing;return w;end $$;
create function public.gith_save_entry(w uuid, entry_id uuid, entry_kind text, entry_day text, payload jsonb, expected_version integer) returns public.gith_entries language plpgsql security definer set search_path=public as $$ declare old gith_entries; result gith_entries;begin
if not gith_member(w) then raise exception 'Device is not connected';end if;
if jsonb_typeof(payload)<>'object' or jsonb_typeof(payload->'meal')<>'string' or coalesce(length(trim(payload->>'meal')),0) not between 1 and 160 then raise exception 'Meal name is required';end if;
if coalesce(length(payload->>'dietary'),0)>200 or coalesce(length(payload->>'cook'),0)>160 or coalesce(length(payload->>'photo'),0)>6000000 then raise exception 'Entry is too large';end if;
if coalesce(payload->>'photo','')<>'' and (payload->>'photo') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then raise exception 'Invalid photo';end if;
if payload->>'qty' is not null and ((payload->>'qty') !~ '^[0-9]+$' or (payload->>'qty')::numeric not between 1 and 500) then raise exception 'Invalid meal count';end if;
select * into old from gith_entries where id=entry_id for update;
if found then
if old.workspace_id<>w or (old.owner_id<>auth.uid() and not gith_admin(w)) then raise exception 'You can only edit your own entries';end if;
if old.version<>expected_version then raise exception 'This entry changed on another device. Refresh before editing.';end if;
if old.kind<>entry_kind or old.day<>entry_day then raise exception 'Entry type cannot change';end if;
update gith_entries set data=payload,version=version+1 where id=entry_id returning * into result;
else
if expected_version<>0 then raise exception 'Entry no longer exists';end if;
insert into gith_entries(id,workspace_id,owner_id,kind,day,data) values(entry_id,w,auth.uid(),entry_kind,entry_day,payload) returning * into result;
end if;return result;end $$;
create function public.gith_delete_entry(w uuid, entry_id uuid, expected_version integer) returns void language plpgsql security definer set search_path=public as $$ begin
if not gith_admin(w) then raise exception 'Only admins can remove entries';end if;
delete from gith_entries where workspace_id=w and id=entry_id and version=expected_version;
if not found then raise exception 'Entry changed or was already removed. Refresh first.';end if;end $$;
create function public.gith_remove_device(w uuid, device_user uuid) returns void language plpgsql security definer set search_path=public as $$ begin
if not gith_admin(w) then raise exception 'Admin access required';end if;
if device_user=auth.uid() then raise exception 'Cannot remove your own admin device';end if;
delete from gith_devices where workspace_id=w and user_id=device_user and role='editor';end $$;
revoke execute on function public.gith_member(uuid),public.gith_admin(uuid),public.gith_create_workspace(text,text),public.gith_make_invite(uuid),public.gith_join_workspace(uuid,text),public.gith_save_entry(uuid,uuid,text,text,jsonb,integer),public.gith_delete_entry(uuid,uuid,integer),public.gith_remove_device(uuid,uuid) from public,anon;
grant execute on function public.gith_member(uuid),public.gith_admin(uuid),public.gith_create_workspace(text,text),public.gith_make_invite(uuid),public.gith_join_workspace(uuid,text),public.gith_save_entry(uuid,uuid,text,text,jsonb,integer),public.gith_delete_entry(uuid,uuid,integer),public.gith_remove_device(uuid,uuid) to authenticated;
