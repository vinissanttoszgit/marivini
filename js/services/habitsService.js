import { isSupabaseConfigured, supabase } from "../config/supabase.js";
import { getCurrentUserId } from "./authService.js";

const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5, 6, 0];

function ensureClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Configure o Supabase em /js/config/supabase.js para usar os hábitos.");
  }
}

function normalizeActiveDays(activeDays) {
  if (!Array.isArray(activeDays) || !activeDays.length) {
    return [...DEFAULT_ACTIVE_DAYS];
  }

  const uniqueDays = [
    ...new Set(
      activeDays
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    )
  ];

  return uniqueDays.length ? uniqueDays : [...DEFAULT_ACTIVE_DAYS];
}

async function listHabits() {
  return listHabitsIncludingInactive({ onlyActive: true });
}

async function listHabitsIncludingInactive({ onlyActive = false } = {}) {
  ensureClient();
  const userId = await getCurrentUserId();

  let query = supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (onlyActive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((habit) => ({
    ...habit,
    active_days: normalizeActiveDays(habit.active_days)
  }));
}

async function createHabit(payload) {
  ensureClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      title: payload.title,
      description: payload.description || null,
      icon: payload.icon || "✨",
      position: payload.position ?? 0,
      active_days: normalizeActiveDays(payload.active_days),
      is_active: true
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    active_days: normalizeActiveDays(data?.active_days)
  };
}

async function updateHabit(id, payload) {
  ensureClient();

  const updates = {
    title: payload.title,
    description: payload.description || null,
    icon: payload.icon || "✨",
    active_days: normalizeActiveDays(payload.active_days),
    updated_at: new Date().toISOString()
  };

  if ("position" in payload) {
    updates.position = payload.position;
  }

  const { data, error } = await supabase
    .from("habits")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    active_days: normalizeActiveDays(data?.active_days)
  };
}

async function deleteHabit(id) {
  ensureClient();

  const { error } = await supabase.from("habits").update({ is_active: false }).eq("id", id);

  if (error) {
    throw error;
  }
}

async function deleteHabits(ids) {
  ensureClient();

  if (!ids?.length) {
    return;
  }

  const { error } = await supabase.from("habits").update({ is_active: false }).in("id", ids);

  if (error) {
    throw error;
  }
}

export default {
  listHabits,
  listHabitsIncludingInactive,
  createHabit,
  updateHabit,
  deleteHabit,
  deleteHabits
};
