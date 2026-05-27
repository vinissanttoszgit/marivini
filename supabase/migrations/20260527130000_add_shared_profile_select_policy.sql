drop policy if exists profiles_select_shared_viewer on public.profiles;
create policy profiles_select_shared_viewer
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.account_view_permissions p
    where p.owner_user_id = profiles.id
      and p.viewer_user_id = auth.uid()
  )
);
