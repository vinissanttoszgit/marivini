import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { errorResponse, handleCors, jsonResponse } from "../_shared/responses.ts";
import { hasNotificationDelivery, recordNotificationDelivery, sendPushToUser } from "../_shared/push.ts";

type HabitCompletionRequest = {
  habit_id?: string;
  log_date?: string;
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  try {
    const { habit_id: habitId, log_date: logDate } = (await req.json()) as HabitCompletionRequest;
    if (!habitId || !logDate) {
      return errorResponse("habit_id and log_date are required.", 400);
    }

    const user = await getAuthenticatedUser(req);
    const supabaseAdmin = getSupabaseAdmin();

    const { data: habit, error: habitError } = await supabaseAdmin
      .from("habits")
      .select("id, title, user_id")
      .eq("id", habitId)
      .maybeSingle();

    if (habitError) {
      throw habitError;
    }

    if (!habit) {
      return errorResponse("Habit not found.", 404);
    }

    if (String(habit.user_id) !== String(user.id)) {
      return errorResponse("User cannot notify completion for this habit.", 403);
    }

    const { data: log, error: logError } = await supabaseAdmin
      .from("habit_logs")
      .select("id, completed")
      .eq("user_id", user.id)
      .eq("habit_id", habitId)
      .eq("log_date", logDate)
      .maybeSingle();

    if (logError) {
      throw logError;
    }

    if (!log?.completed) {
      return errorResponse("Completed habit log not found.", 400);
    }

    const [{ data: permissions, error: permissionsError }, { data: ownerProfile, error: ownerProfileError }] =
      await Promise.all([
        supabaseAdmin
          .from("account_view_permissions")
          .select("viewer_user_id")
          .eq("owner_user_id", habit.user_id)
          .eq("can_view_habits", true),
        supabaseAdmin.from("profiles").select("name").eq("id", habit.user_id).maybeSingle()
      ]);

    if (permissionsError) {
      throw permissionsError;
    }

    if (ownerProfileError) {
      throw ownerProfileError;
    }

    const actorName = ownerProfile?.name?.trim() || "Alguém";
    const targetUserIds = [...new Set((permissions ?? []).map((item) => item.viewer_user_id).filter(Boolean))].filter(
      (viewerUserId) => String(viewerUserId) !== String(user.id)
    );

    const results = [];

    for (const targetUserId of targetUserIds) {
      const dedupeKey = `shared_habit:${targetUserId}:${habitId}:${logDate}`;
      if (await hasNotificationDelivery(dedupeKey)) {
        results.push({ targetUserId, skipped: true, reason: "duplicate" });
        continue;
      }

      const payload = {
        title: "Marivini",
        body: `${actorName} concluiu "${habit.title}".`,
        url: "/index.html",
        tag: `shared-habit-${habitId}-${logDate}`
      };
      const summary = await sendPushToUser(targetUserId, payload);

      if (summary.sent > 0) {
        await recordNotificationDelivery({
          userId: targetUserId,
          dedupeKey,
          notificationType: "shared_habit_completed",
          payload,
          status: "sent",
          summary
        });
      } else if (summary.attempted > 0) {
        await recordNotificationDelivery({
          userId: targetUserId,
          dedupeKey,
          notificationType: "shared_habit_completed",
          payload,
          status: "error",
          summary,
          errorMessage: "No active subscription accepted delivery."
        });
      }

      results.push({ targetUserId, summary });
    }

    return jsonResponse({ ok: true, habitId, logDate, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to notify shared habit completion.";
    const status = message === "Missing bearer token." ? 401 : 500;
    return errorResponse(message, status);
  }
});
