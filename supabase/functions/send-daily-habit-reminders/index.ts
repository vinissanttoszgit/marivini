import { hasNotificationDelivery, recordNotificationDelivery, sendPushToUser } from "../_shared/push.ts";
import { getRequiredEnv, getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";

const TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5, 6, 0];

type Habit = {
  id: string;
  active_days: number[] | null;
};

type HabitScheduleOverride = {
  id: string;
  habit_id: string;
  original_date: string;
  target_date: string;
};

function getTodayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function getWeekdayIndex(isoDate: string) {
  return new Date(`${isoDate}T12:00:00-03:00`).getDay();
}

function normalizeActiveDays(activeDays: number[] | null) {
  if (!Array.isArray(activeDays) || !activeDays.length) {
    return [...DEFAULT_ACTIVE_DAYS];
  }

  const uniqueDays = [...new Set(activeDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return uniqueDays.length ? uniqueDays : [...DEFAULT_ACTIVE_DAYS];
}

function getHabitScheduledForDate(habit: Habit, date: string, scheduleOverrides: HabitScheduleOverride[]) {
  const habitId = String(habit.id);
  const targetOverride = scheduleOverrides.find(
    (override) => String(override.habit_id) === habitId && override.target_date === date
  );

  if (targetOverride) {
    return true;
  }

  const originalOverride = scheduleOverrides.find(
    (override) => String(override.habit_id) === habitId && override.original_date === date
  );

  if (originalOverride && originalOverride.target_date !== date) {
    return false;
  }

  return normalizeActiveDays(habit.active_days).includes(getWeekdayIndex(date));
}

async function listEnabledUserIds() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("user_id")
    .eq("enabled", true);

  if (error) {
    throw error;
  }

  return [...new Set((data ?? []).map((item) => item.user_id).filter(Boolean))];
}

async function listActiveHabits(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("habits")
    .select("id, active_days")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return (data ?? []) as Habit[];
}

async function listOverridesForToday(userId: string, date: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("habit_schedule_overrides")
    .select("id, habit_id, original_date, target_date")
    .eq("user_id", userId)
    .eq("override_type", "postponed")
    .or(`original_date.eq.${date},target_date.eq.${date}`);

  if (error) {
    throw error;
  }

  return (data ?? []) as HabitScheduleOverride[];
}

async function listCompletedHabitIds(userId: string, date: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("habit_logs")
    .select("habit_id")
    .eq("user_id", userId)
    .eq("log_date", date)
    .eq("completed", true);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((item) => String(item.habit_id)));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== getRequiredEnv("CRON_SECRET")) {
    return errorResponse("Unauthorized.", 401);
  }

  try {
    const date = getTodayInSaoPaulo();
    const userIds = await listEnabledUserIds();
    const results = [];

    for (const userId of userIds) {
      const dedupeKey = `daily_habits:${userId}:${date}`;
      if (await hasNotificationDelivery(dedupeKey)) {
        results.push({ userId, skipped: true, reason: "duplicate" });
        continue;
      }

      const [habits, scheduleOverrides, completedHabitIds] = await Promise.all([
        listActiveHabits(userId),
        listOverridesForToday(userId, date),
        listCompletedHabitIds(userId, date)
      ]);

      const incompleteCount = habits.filter((habit) => {
        if (!getHabitScheduledForDate(habit, date, scheduleOverrides)) {
          return false;
        }

        return !completedHabitIds.has(String(habit.id));
      }).length;

      if (!incompleteCount) {
        results.push({ userId, skipped: true, reason: "no-incomplete-habits" });
        continue;
      }

      const payload = {
        title: "Marivini",
        body: `Você ainda tem ${incompleteCount} hábito${incompleteCount > 1 ? "s" : ""} para concluir hoje.`,
        url: "/index.html",
        tag: `daily-habit-reminder-${date}`
      };
      const summary = await sendPushToUser(userId, payload);

      if (summary.sent > 0) {
        await recordNotificationDelivery({
          userId,
          dedupeKey,
          notificationType: "daily_habit_reminder",
          payload,
          status: "sent",
          summary
        });
      } else if (summary.attempted > 0) {
        await recordNotificationDelivery({
          userId,
          dedupeKey,
          notificationType: "daily_habit_reminder",
          payload,
          status: "error",
          summary,
          errorMessage: "No active subscription accepted delivery."
        });
      }

      results.push({ userId, incompleteCount, summary });
    }

    return jsonResponse({ ok: true, date, results });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to send reminders.", 500);
  }
});
