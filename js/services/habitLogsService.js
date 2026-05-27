import { isSupabaseConfigured, supabase } from "../config/supabase.js";
import { getCurrentUserId } from "./authService.js";
import viewContextService from "./viewContextService.js";

function ensureClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Configure o Supabase em /js/config/supabase.js para usar os logs de habitos.");
  }
}

async function listLogsByDate(date) {
  ensureClient();
  const userId = await viewContextService.getActiveUserId("habits");
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", date)
    .eq("completed", true);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listLogsRange({ startDate, endDate }) {
  ensureClient();
  const userId = await viewContextService.getActiveUserId("habits");
  const { data, error } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", startDate)
    .lte("log_date", endDate)
    .order("log_date", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function markHabitComplete({ habitId, date }) {
  ensureClient();
  await viewContextService.ensureCanEdit();
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("habit_logs")
    .upsert(
      {
        user_id: userId,
        habit_id: habitId,
        log_date: date,
        completed: true
      },
      { onConflict: "user_id,habit_id,log_date" }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function unmarkHabitComplete({ habitId, date }) {
  ensureClient();
  await viewContextService.ensureCanEdit();
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("habit_logs")
    .delete()
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .eq("log_date", date);

  if (error) {
    throw error;
  }
}

export default {
  listLogsByDate,
  listLogsRange,
  markHabitComplete,
  unmarkHabitComplete
};
