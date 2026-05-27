import { isSupabaseConfigured, supabase } from "../config/supabase.js";
import { getCurrentUserId } from "./authService.js";
import viewContextService from "./viewContextService.js";

function ensureClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Configure o Supabase em /js/config/supabase.js para usar adiamentos de hábitos.");
  }
}

async function listOverridesRange({ startDate, endDate }) {
  ensureClient();
  const userId = await viewContextService.getActiveUserId("habits");
  const { data, error } = await supabase
    .from("habit_schedule_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("override_type", "postponed")
    .or(`and(original_date.gte.${startDate},original_date.lte.${endDate}),and(target_date.gte.${startDate},target_date.lte.${endDate})`)
    .order("target_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listOverridesByTargetDate(date) {
  ensureClient();
  const userId = await viewContextService.getActiveUserId("habits");
  const { data, error } = await supabase
    .from("habit_schedule_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("target_date", date)
    .eq("override_type", "postponed");

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function postponeHabitOccurrence({ habitId, originalDate, targetDate }) {
  ensureClient();
  await viewContextService.ensureCanEdit();
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("habit_schedule_overrides")
    .upsert(
      {
        user_id: userId,
        habit_id: habitId,
        original_date: originalDate,
        target_date: targetDate,
        override_type: "postponed",
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,habit_id,original_date" }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function deleteOverride(id) {
  ensureClient();
  await viewContextService.ensureCanEdit();
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("habit_schedule_overrides")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export default {
  listOverridesRange,
  listOverridesByTargetDate,
  postponeHabitOccurrence,
  deleteOverride
};
