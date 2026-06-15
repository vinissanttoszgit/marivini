import { getAuthenticatedUser } from "../_shared/supabaseAdmin.ts";
import { sendPushToUser } from "../_shared/push.ts";
import { errorResponse, handleCors, jsonResponse } from "../_shared/responses.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  try {
    const user = await getAuthenticatedUser(req);
    const summary = await sendPushToUser(user.id, {
      title: "Marivini",
      body: "Teste real enviado pelo servidor.",
      url: "/index.html",
      tag: "server-test-push"
    });

    if (!summary.attempted) {
      return errorResponse("Nenhuma subscription ativa encontrada para este usuário.", 400);
    }

    return jsonResponse({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send push.";
    const status = message === "Missing bearer token." ? 401 : 500;
    return errorResponse(message, status);
  }
});
