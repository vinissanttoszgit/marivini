import webpush from "npm:web-push@3.6.7";
import { getRequiredEnv, getSupabaseAdmin } from "./supabaseAdmin.ts";

const DEFAULT_TITLE = "Marivini";
const DEFAULT_URL = "/index.html";
const DEFAULT_ICON = "/assets/icons/icon-192.png";
const DEFAULT_BADGE = "/assets/icons/badge-96.png";

type JsonRecord = Record<string, unknown>;

export type PushPayload = {
  title?: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: JsonRecord;
};

export type PushSubscriptionRecord = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: boolean;
};

export type PushSendSummary = {
  attempted: number;
  sent: number;
  failed: number;
  disabledSubscriptionIds: string[];
};

export type PushUserSummary = PushSendSummary & {
  userId: string;
};

export type PushSendOptions = {
  notificationType?: string;
};

type DeliveryStatus = "sent" | "error";

let vapidConfigured = false;

function configureWebPush() {
  if (vapidConfigured) {
    return;
  }

  webpush.setVapidDetails(
    getRequiredEnv("VAPID_SUBJECT"),
    getRequiredEnv("VAPID_PUBLIC_KEY"),
    getRequiredEnv("VAPID_PRIVATE_KEY")
  );
  vapidConfigured = true;
}

function getDefaultPayload(payload: PushPayload) {
  const title = payload.title?.trim() || DEFAULT_TITLE;
  const url = payload.url?.trim() || DEFAULT_URL;

  return {
    title,
    body: payload.body,
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    tag: payload.tag || "marivini-push-notification",
    data: {
      url,
      ...(payload.data ?? {})
    }
  };
}

function mapToWebPushSubscription(subscription: PushSubscriptionRecord) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth
    }
  };
}

function isInvalidSubscriptionError(error: unknown) {
  const statusCode = typeof error === "object" && error !== null ? Reflect.get(error, "statusCode") : null;
  return statusCode === 404 || statusCode === 410;
}

async function disableSubscriptions(subscriptionIds: string[]) {
  if (!subscriptionIds.length) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .update({
      enabled: false,
      updated_at: new Date().toISOString()
    })
    .in("id", subscriptionIds);

  if (error) {
    throw error;
  }
}

async function listEnabledSubscriptions(userIds: string[]) {
  if (!userIds.length) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, enabled")
    .in("user_id", userIds)
    .eq("enabled", true);

  if (error) {
    throw error;
  }

  return (data ?? []) as PushSubscriptionRecord[];
}

export async function hasNotificationDelivery(dedupeKey: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("notification_deliveries")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function recordNotificationDelivery({
  userId,
  dedupeKey,
  notificationType,
  payload,
  status,
  summary,
  errorMessage = null
}: {
  userId: string;
  dedupeKey: string;
  notificationType: string;
  payload: PushPayload;
  status: DeliveryStatus;
  summary: PushSendSummary;
  errorMessage?: string | null;
}) {
  const normalizedPayload = getDefaultPayload(payload);
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("notification_deliveries").insert({
    user_id: userId,
    dedupe_key: dedupeKey,
    notification_type: notificationType,
    title: normalizedPayload.title,
    body: normalizedPayload.body,
    url: normalizedPayload.data.url,
    tag: normalizedPayload.tag,
    status,
    error_message: errorMessage,
    metadata: {
      attempted: summary.attempted,
      sent: summary.sent,
      failed: summary.failed,
      disabled_subscription_ids: summary.disabledSubscriptionIds
    },
    sent_at: new Date().toISOString()
  });

  if (error) {
    throw error;
  }
}

export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRecord[],
  payload: PushPayload,
  _options: PushSendOptions = {}
) {
  configureWebPush();

  const normalizedPayload = getDefaultPayload(payload);
  const summary: PushSendSummary = {
    attempted: subscriptions.length,
    sent: 0,
    failed: 0,
    disabledSubscriptionIds: []
  };

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        mapToWebPushSubscription(subscription),
        JSON.stringify(normalizedPayload)
      );
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;

      if (isInvalidSubscriptionError(error)) {
        summary.disabledSubscriptionIds.push(subscription.id);
      }
    }
  }

  if (summary.disabledSubscriptionIds.length) {
    await disableSubscriptions(summary.disabledSubscriptionIds);
  }

  return summary;
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload, options: PushSendOptions = {}) {
  const normalizedUserIds = [...new Set(userIds.map(String).filter(Boolean))];
  const subscriptions = await listEnabledSubscriptions(normalizedUserIds);
  const subscriptionsByUser = new Map<string, PushSubscriptionRecord[]>();

  subscriptions.forEach((subscription) => {
    const current = subscriptionsByUser.get(subscription.user_id) ?? [];
    current.push(subscription);
    subscriptionsByUser.set(subscription.user_id, current);
  });

  const results: PushUserSummary[] = [];

  for (const userId of normalizedUserIds) {
    const summary = await sendPushToSubscriptions(subscriptionsByUser.get(userId) ?? [], payload, options);
    results.push({
      userId,
      ...summary
    });
  }

  return {
    attempted: results.reduce((total, item) => total + item.attempted, 0),
    sent: results.reduce((total, item) => total + item.sent, 0),
    failed: results.reduce((total, item) => total + item.failed, 0),
    disabledSubscriptionIds: results.flatMap((item) => item.disabledSubscriptionIds),
    results
  };
}

export async function sendPushToUser(userId: string, payload: PushPayload, options: PushSendOptions = {}) {
  const result = await sendPushToUsers([userId], payload, options);

  return (
    result.results[0] ?? {
      userId,
      attempted: 0,
      sent: 0,
      failed: 0,
      disabledSubscriptionIds: []
    }
  );
}
