import { hasNotificationDelivery, recordNotificationDelivery, sendPushToUser } from "../_shared/push.ts";
import { getRequiredEnv, getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";

const TIME_ZONE = "America/Sao_Paulo";
const REMINDER_WINDOW_MINUTES = 5;

type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  reminder_minutes: number | null;
};

function getDateInSaoPaulo(offsetDays = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function toEventTimestamp(event: CalendarEvent) {
  return new Date(`${event.event_date}T${event.event_time}:00-03:00`).getTime();
}

async function listEventRecipientUserIds(ownerUserId: string) {
  const normalizedOwnerUserId = String(ownerUserId).trim();
  if (!normalizedOwnerUserId) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("account_view_permissions")
    .select("viewer_user_id")
    .eq("owner_user_id", normalizedOwnerUserId)
    .eq("can_view_calendar", true);

  if (error) {
    throw error;
  }

  return [
    ...new Set(
      [normalizedOwnerUserId, ...(data ?? []).map((item) => item.viewer_user_id).filter(Boolean)].map(String)
    )
  ];
}

async function listEventsForReminderWindow() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, user_id, title, event_date, event_time, reminder_minutes")
    .not("reminder_minutes", "is", null)
    .not("event_time", "is", null)
    .gte("event_date", getDateInSaoPaulo())
    .lte("event_date", getDateInSaoPaulo(1))
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CalendarEvent[];
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
    const now = Date.now();
    const windowStart = now - REMINDER_WINDOW_MINUTES * 60 * 1000;
    const events = await listEventsForReminderWindow();
    const results = [];

    for (const event of events) {
      try {
        if (!event.event_time || !event.reminder_minutes) {
          continue;
        }

        const reminderAt = toEventTimestamp(event) - Number(event.reminder_minutes) * 60 * 1000;
        if (reminderAt < windowStart || reminderAt > now) {
          continue;
        }

        const minutes = Number(event.reminder_minutes);
        const payload = {
          title: "Marivini",
          body: `Seu evento "${event.title}" começa em ${minutes} minuto${minutes > 1 ? "s" : ""}.`,
          url: "/index.html",
          tag: `calendar-reminder-${event.id}`
        };
        const targetUserIds = await listEventRecipientUserIds(event.user_id);

        for (const targetUserId of targetUserIds) {
          try {
            const dedupeKey = `calendar:${targetUserId}:${event.id}:${event.reminder_minutes}`;
            if (await hasNotificationDelivery(dedupeKey)) {
              results.push({ eventId: event.id, targetUserId, skipped: true, reason: "duplicate" });
              continue;
            }

            const summary = await sendPushToUser(targetUserId, payload);

            if (summary.sent > 0) {
              await recordNotificationDelivery({
                userId: targetUserId,
                dedupeKey,
                notificationType: "calendar_reminder",
                payload,
                status: "sent",
                summary
              });
            } else if (summary.attempted > 0) {
              await recordNotificationDelivery({
                userId: targetUserId,
                dedupeKey,
                notificationType: "calendar_reminder",
                payload,
                status: "error",
                summary,
                errorMessage: "No active subscription accepted delivery."
              });
            }

            results.push({ eventId: event.id, targetUserId, summary });
          } catch (error) {
            results.push({
              eventId: event.id,
              targetUserId,
              error: error instanceof Error ? error.message : "Failed to send recipient reminder."
            });
          }
        }
      } catch (error) {
        results.push({
          eventId: event.id,
          error: error instanceof Error ? error.message : "Failed to process event reminder."
        });
      }
    }

    return jsonResponse({
      ok: true,
      windowMinutes: REMINDER_WINDOW_MINUTES,
      results
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to send calendar reminders.", 500);
  }
});
