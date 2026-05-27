import { isSupabaseConfigured, supabase } from "../config/supabase.js";
import { getCurrentUserId } from "./authService.js";

function ensureClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Configure o Supabase em /js/config/supabase.js para usar os eventos.");
  }
}

async function listEventsByMonth({ startDate, endDate }) {
  ensureClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listPendingEvents({ startDate, limit = 20 } = {}) {
  ensureClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("event_date", startDate)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listEventsByDate(date) {
  ensureClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("event_date", date)
    .order("event_time", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function createEvent(payload) {
  ensureClient();
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      title: payload.title,
      description: payload.description || null,
      icon: payload.icon || "🗓️",
      event_date: payload.eventDate,
      event_time: payload.eventTime || null,
      reminder_minutes: payload.reminderMinutes ? Number(payload.reminderMinutes) : null
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateEvent(id, payload) {
  ensureClient();
  const { data, error } = await supabase
    .from("events")
    .update({
      title: payload.title,
      description: payload.description || null,
      icon: payload.icon || "🗓️",
      event_date: payload.eventDate,
      event_time: payload.eventTime || null,
      reminder_minutes: payload.reminderMinutes ? Number(payload.reminderMinutes) : null,
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

async function deleteEvent(id) {
  ensureClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export default {
  listEventsByMonth,
  listPendingEvents,
  listEventsByDate,
  createEvent,
  updateEvent,
  deleteEvent
};
