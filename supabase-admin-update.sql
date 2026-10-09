-- Run this update once in Supabase SQL Editor.
create or replace function public.gith_promote_device(w uuid, device_user uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.gith_admin(w) then raise exception 'Admin access required'; end if;
  update public.gith_devices set role='admin'
  where workspace_id=w and user_id=device_user;
  if not found then raise exception 'Device is not a member of this workspace'; end if;
end $$;
revoke execute on function public.gith_promote_device(uuid,uuid) from public,anon;
grant execute on function public.gith_promote_device(uuid,uuid) to authenticated;
