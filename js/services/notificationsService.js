const ENABLED_KEY = "marivini:notifications-enabled";
const DEFAULT_TITLE = "Marivini";
const DEFAULT_BODY = "Notificações ativadas neste celular.";
const DEFAULT_URL = new URL("../../index.html", import.meta.url).href;
const DEFAULT_ICON = new URL("../../assets/icons/icon-192.png", import.meta.url).href;
const DEFAULT_BADGE = new URL("../../assets/icons/badge-96.png", import.meta.url).href;

let serviceWorkerRegistration = null;

function supportsNotifications() {
  return "Notification" in window;
}

function supportsServiceWorker() {
  return "serviceWorker" in navigator;
}

function isSupported() {
  return supportsNotifications() && supportsServiceWorker();
}

function getPermissionState() {
  if (!supportsNotifications()) {
    return "unsupported";
  }

  return Notification.permission;
}

function getStoredEnabledState() {
  return window.localStorage.getItem(ENABLED_KEY) === "true";
}

function isEnabled() {
  return getStoredEnabledState() && getPermissionState() === "granted";
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

async function requestPermission() {
  if (!isSupported()) {
    return "unsupported";
  }

  return Notification.requestPermission();
}

async function enableOnThisDevice() {
  const permission = await requestPermission();

  if (permission === "granted") {
    window.localStorage.setItem(ENABLED_KEY, "true");
  }

  return permission;
}

function disableOnThisDevice() {
  window.localStorage.removeItem(ENABLED_KEY);
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

  if (serviceWorkerRegistration?.showNotification) {
    await serviceWorkerRegistration.showNotification(DEFAULT_TITLE, options);
    return;
  }

  new Notification(DEFAULT_TITLE, options);
}

const notificationsService = {
  disableOnThisDevice,
  enableOnThisDevice,
  getPermissionState,
  getStoredEnabledState,
  isEnabled,
  isSupported,
  registerServiceWorker,
  requestPermission,
  sendTestNotification,
  setServiceWorkerRegistration
};

export default notificationsService;
