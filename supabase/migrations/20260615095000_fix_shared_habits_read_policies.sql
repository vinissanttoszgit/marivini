drop policy if exists habits_select_shared_viewer on public.habits;
drop policy if exists habits_select_own_or_shared on public.habits;
create policy habits_select_own_or_shared
on public.habits
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.account_view_permissions p
    where p.owner_user_id = habits.user_id
      and p.viewer_user_id = auth.uid()
      and p.can_view_habits = true
  )
);

drop policy if exists habit_logs_select_shared_viewer on public.habit_logs;
drop policy if exists habit_logs_select_own_or_shared on public.habit_logs;
create policy habit_logs_select_own_or_shared
on public.habit_logs
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.account_view_permissions p
    where p.owner_user_id = habit_logs.user_id
      and p.viewer_user_id = auth.uid()
      and p.can_view_habits = true
  )
);

drop policy if exists habit_schedule_overrides_select_shared_viewer on public.habit_schedule_overrides;
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
