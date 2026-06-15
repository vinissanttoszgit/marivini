import { isSupabaseConfigured, supabase } from "../config/supabase.js";
import authService from "./authService.js";

const LEGACY_ENABLED_KEY = "marivini:notifications-enabled";
const VAPID_PUBLIC_KEY = "COLE_AQUI_SUA_VAPID_PUBLIC_KEY";
const DEFAULT_TITLE = "Marivini";
const DEFAULT_BODY = "Notificações ativadas neste celular.";
const DEFAULT_URL = new URL("../../index.html", import.meta.url).href;
const DEFAULT_ICON = new URL("../../assets/icons/icon-192.png", import.meta.url).href;
const DEFAULT_BADGE = new URL("../../assets/icons/badge-96.png", import.meta.url).href;

let serviceWorkerRegistration = null;

function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Configure o Supabase antes de ativar notificações push.");
  }
}

function supportsNotifications() {
  return "Notification" in window;
}

function supportsServiceWorker() {
  return "serviceWorker" in navigator;
}

function supportsPushManager() {
  return "PushManager" in window;
}

function isSupported() {
  return supportsNotifications() && supportsServiceWorker() && supportsPushManager();
}

function isVapidConfigured() {
  return Boolean(VAPID_PUBLIC_KEY) && !VAPID_PUBLIC_KEY.startsWith("COLE_AQUI");
}

function getPermissionState() {
  if (!supportsNotifications()) {
    return "unsupported";
  }

  return Notification.permission;
}

function clearLegacyEnabledState() {
  window.localStorage.removeItem(LEGACY_ENABLED_KEY);
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalizedBase64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(normalizedBase64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function arrayBufferToBase64(buffer) {
  if (!buffer) {
    return "";
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

function extractSubscriptionPayload(subscription, userId) {
  return {
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: arrayBufferToBase64(subscription.getKey("p256dh")),
    auth: arrayBufferToBase64(subscription.getKey("auth")),
    user_agent: navigator.userAgent,
    enabled: true,
    updated_at: new Date().toISOString()
  };
}

async function saveSubscription(subscription, userId) {
  ensureSupabase();
  const payload = extractSubscriptionPayload(subscription, userId);
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "user_id,endpoint" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function disableSubscriptionRecord({ endpoint, userId }) {
  ensureSupabase();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({
      enabled: false,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    throw error;
  }
}

async function loadSubscriptionRecord({ endpoint, userId }) {
  ensureSupabase();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("enabled, endpoint, updated_at")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

function setServiceWorkerRegistration(registration) {
  serviceWorkerRegistration = registration ?? null;
}

async function registerServiceWorker() {
  if (!supportsServiceWorker()) {
    return null;
  }

  const registration = await navigator.serviceWorker.register("./service-worker.js");
  setServiceWorkerRegistration(registration);
  return registration;
}

async function getReadyServiceWorkerRegistration() {
  if (!supportsServiceWorker()) {
    return null;
  }

  if (serviceWorkerRegistration) {
    return serviceWorkerRegistration;
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration("./");
  if (existingRegistration) {
    setServiceWorkerRegistration(existingRegistration);
    return existingRegistration;
  }

  await registerServiceWorker();
  const readyRegistration = await navigator.serviceWorker.ready;
  setServiceWorkerRegistration(readyRegistration);
  return readyRegistration;
}

async function requestPermission() {
  if (!isSupported()) {
    return "unsupported";
  }

  return Notification.requestPermission();
}

async function getCurrentSubscriptionStatus() {
  const supported = isSupported();
  const permission = getPermissionState();
  const vapidConfigured = isVapidConfigured();
  let subscription = null;
  let subscriptionRecord = null;

  if (supported && permission === "granted") {
    try {
      const registration = await getReadyServiceWorkerRegistration();
      subscription = await registration?.pushManager.getSubscription();

      if (subscription && isSupabaseConfigured && supabase) {
        const user = await authService.getUser();
        if (user?.id) {
          subscriptionRecord = await loadSubscriptionRecord({
            endpoint: subscription.endpoint,
            userId: user.id
          });
        }
      }
    } catch {
      subscription = null;
      subscriptionRecord = null;
    }
  }

  return {
    enabled: Boolean(subscription && subscriptionRecord?.enabled === true),
    permission,
    pushSupported: supported,
    subscription,
    subscriptionRecord,
    supported,
    vapidConfigured
  };
}

async function enableOnThisDevice() {
  if (!isSupported()) {
    return { permission: "unsupported", status: await getCurrentSubscriptionStatus() };
  }

  if (!isVapidConfigured()) {
    throw new Error("A chave pública VAPID ainda precisa ser configurada.");
  }

  ensureSupabase();
  const user = await authService.getUser();
  if (!user?.id) {
    throw new Error("Usuário não autenticado.");
  }

  const permission = await requestPermission();
  if (permission !== "granted") {
    return { permission, status: await getCurrentSubscriptionStatus() };
  }

  const registration = await getReadyServiceWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  await saveSubscription(subscription, user.id);
  clearLegacyEnabledState();

  return {
    permission,
    status: await getCurrentSubscriptionStatus(),
    subscription
  };
}

async function disableOnThisDevice() {
  const user = await authService.getUser();
  const registration = await getReadyServiceWorkerRegistration();
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription && user?.id && isSupabaseConfigured && supabase) {
    await disableSubscriptionRecord({
      endpoint: subscription.endpoint,
      userId: user.id
    });
  }

  if (subscription) {
    try {
      await subscription.unsubscribe();
    } catch {
      // Ignore unsubscribe failures after DB flag update.
    }
  }

  clearLegacyEnabledState();
  return getCurrentSubscriptionStatus();
}

async function sendTestNotification() {
  if (!supportsNotifications()) {
    throw new Error("Este navegador não suporta notificações.");
  }

  if (getPermissionState() !== "granted") {
    throw new Error("Permissão de notificação não concedida.");
  }

  const options = {
    body: DEFAULT_BODY,
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: "marivini-test-notification",
    renotify: true,
    data: {
      url: DEFAULT_URL
    }
  };

  const registration = await getReadyServiceWorkerRegistration();

  if (registration?.showNotification) {
    await registration.showNotification(DEFAULT_TITLE, options);
    return;
  }

  new Notification(DEFAULT_TITLE, options);
}

const notificationsService = {
  disableOnThisDevice,
  enableOnThisDevice,
  getCurrentSubscriptionStatus,
  getPermissionState,
  isSupported,
  registerServiceWorker,
  requestPermission,
  sendTestNotification,
  setServiceWorkerRegistration
};

export default notificationsService;
