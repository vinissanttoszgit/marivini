import { isSupabaseConfigured, supabase } from "../config/supabase.js";
import { getCurrentUserId } from "./authService.js";

function ensureClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Configure o Supabase em /js/config/supabase.js para usar os habitos.");
  }
}

async function listHabits() {
  ensureClient();
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
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
      is_active: true
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateHabit(id, payload) {
  ensureClient();
  const { data, error } = await supabase
    .from("habits")
    .update({
      title: payload.title,
      description: payload.description || null,
      icon: payload.icon || "✨",
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function deleteHabit(id) {
  ensureClient();
  const { error } = await supabase.from("habits").update({ is_active: false }).eq("id", id);
  if (error) {
    throw error;
  }
}

export default {
  listHabits,
  createHabit,
  updateHabit,
  deleteHabit
};
