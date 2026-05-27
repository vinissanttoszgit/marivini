create table if not exists public.habit_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  original_date date not null,
  target_date date not null,
  override_type text not null default 'postponed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habit_schedule_overrides_unique unique (user_id, habit_id, original_date),
  constraint habit_schedule_overrides_type_check check (override_type = 'postponed')
);

alter table public.habit_schedule_overrides enable row level security;

grant select, insert, update, delete on public.habit_schedule_overrides to authenticated;

drop policy if exists habit_schedule_overrides_select_own_or_shared on public.habit_schedule_overrides;
create policy habit_schedule_overrides_select_own_or_shared
on public.habit_schedule_overrides
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.account_view_permissions p
    where p.owner_user_id = habit_schedule_overrides.user_id
      and p.viewer_user_id = auth.uid()
      and p.can_view_habits = true
  )
);

drop policy if exists habit_schedule_overrides_insert_own on public.habit_schedule_overrides;
create policy habit_schedule_overrides_insert_own
on public.habit_schedule_overrides
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists habit_schedule_overrides_update_own on public.habit_schedule_overrides;
create policy habit_schedule_overrides_update_own
on public.habit_schedule_overrides
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists habit_schedule_overrides_delete_own on public.habit_schedule_overrides;
create policy habit_schedule_overrides_delete_own
on public.habit_schedule_overrides
for delete
to authenticated
using (auth.uid() = user_id);
