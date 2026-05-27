create table if not exists public.account_view_permissions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  viewer_user_id uuid not null references public.profiles(id) on delete cascade,
  can_view_habits boolean not null default true,
  can_view_calendar boolean not null default true,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  constraint account_view_permissions_unique unique (owner_user_id, viewer_user_id),
  constraint account_view_permissions_no_self_view check (owner_user_id <> viewer_user_id)
);

alter table public.account_view_permissions enable row level security;

grant select, insert, update, delete on public.account_view_permissions to authenticated;

drop policy if exists account_view_permissions_select_related on public.account_view_permissions;
create policy account_view_permissions_select_related
on public.account_view_permissions
for select
to authenticated
using (
  auth.uid() = owner_user_id
  or auth.uid() = viewer_user_id
);

drop policy if exists account_view_permissions_insert_owner on public.account_view_permissions;
create policy account_view_permissions_insert_owner
on public.account_view_permissions
for insert
to authenticated
with check (auth.uid() = owner_user_id);

drop policy if exists account_view_permissions_update_owner on public.account_view_permissions;
create policy account_view_permissions_update_owner
on public.account_view_permissions
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists account_view_permissions_delete_owner on public.account_view_permissions;
create policy account_view_permissions_delete_owner
on public.account_view_permissions
for delete
to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists habits_select_shared_viewer on public.habits;
create policy habits_select_shared_viewer
on public.habits
for select
to authenticated
using (
  exists (
    select 1
    from public.account_view_permissions p
    where p.owner_user_id = habits.user_id
      and p.viewer_user_id = auth.uid()
      and p.can_view_habits = true
  )
);

drop policy if exists habit_logs_select_shared_viewer on public.habit_logs;
create policy habit_logs_select_shared_viewer
on public.habit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.account_view_permissions p
    where p.owner_user_id = habit_logs.user_id
      and p.viewer_user_id = auth.uid()
      and p.can_view_habits = true
  )
);

alter table public.events enable row level security;

drop policy if exists events_select_authenticated on public.events;
drop policy if exists events_update_authenticated on public.events;
drop policy if exists events_delete_authenticated on public.events;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and cmd in ('SELECT', 'UPDATE', 'DELETE')
      and coalesce(qual, '') in ('true', '(true)')
  loop
    execute format('drop policy if exists %I on public.events', pol.policyname);
  end loop;
end $$;

drop policy if exists events_select_own_or_shared on public.events;
create policy events_select_own_or_shared
on public.events
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.account_view_permissions p
    where p.owner_user_id = events.user_id
      and p.viewer_user_id = auth.uid()
      and p.can_view_calendar = true
  )
);

drop policy if exists events_insert_own on public.events;
create policy events_insert_own
on public.events
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists events_update_own on public.events;
create policy events_update_own
on public.events
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists events_delete_own on public.events;
create policy events_delete_own
on public.events
for delete
to authenticated
using (auth.uid() = user_id);
