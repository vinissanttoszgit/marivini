import { isSupabaseConfigured, supabase } from "../config/supabase.js";
import authService, { getCurrentUserId } from "./authService.js";

const ACTIVE_VIEW_OWNER_KEY = "marivini:active-view-owner-id";
const READ_ONLY_ERROR = "Você está em modo somente visualização.";

function ensureClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Configure o Supabase em /js/config/supabase.js para usar visualizações compartilhadas.");
  }
}

function getStoredOwnerId() {
  return window.localStorage.getItem(ACTIVE_VIEW_OWNER_KEY);
}

function getProfileLabel(profile) {
  return profile?.name || null;
}

function getFallbackLabel(ownerUserId) {
  return ownerUserId ? `Conta ${String(ownerUserId).slice(0, 8)}` : "Conta compartilhada";
}

function normalizePermission(permission) {
  const profile = permission.owner_profile || permission.owner || null;
  return {
    ...permission,
    label: getProfileLabel(profile) || getFallbackLabel(permission.owner_user_id)
  };
}

function hasScopeAccess(permission, scope) {
  if (!permission) {
    return false;
  }

  if (scope === "habits") {
    return permission.can_view_habits === true;
  }

  if (scope === "calendar") {
    return permission.can_view_calendar === true;
  }

  return permission.can_view_habits === true || permission.can_view_calendar === true;
}

async function getOwnUser() {
  return authService.getUser();
}

async function getOwnUserId() {
  return getCurrentUserId();
}

async function fetchPermission(ownerUserId) {
  ensureClient();
  const viewerUserId = await getOwnUserId();
  const { data, error } = await supabase
    .from("account_view_permissions")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("viewer_user_id", viewerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizePermission(data) : null;
}

async function listAvailableViews() {
  ensureClient();
  const viewerUserId = await getOwnUserId();
  const { data, error } = await supabase
    .from("account_view_permissions")
    .select("*, owner_profile:profiles!account_view_permissions_owner_user_id_fkey(id, name)")
    .eq("viewer_user_id", viewerUserId)
    .or("can_view_habits.eq.true,can_view_calendar.eq.true")
    .order("created_at", { ascending: true });

  if (!error) {
    return (data ?? []).map(normalizePermission);
  }

  const fallback = await supabase
    .from("account_view_permissions")
    .select("*")
    .eq("viewer_user_id", viewerUserId)
    .or("can_view_habits.eq.true,can_view_calendar.eq.true")
    .order("created_at", { ascending: true });

  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data ?? []).map(normalizePermission);
}

async function getActiveView() {
  const ownUser = await getOwnUser();
  if (!ownUser) {
    return {
      ownUser: null,
      ownUserId: null,
      activeUserId: null,
      activeView: null,
      activeLabel: "",
      readOnly: false
    };
  }

  const storedOwnerId = getStoredOwnerId();
  if (!storedOwnerId || storedOwnerId === ownUser.id) {
    clearActiveView();
    return {
      ownUser,
      ownUserId: ownUser.id,
      activeUserId: ownUser.id,
      activeView: null,
      activeLabel: ownUser.email ?? "Minha conta",
      readOnly: false
    };
  }

  const permission = await fetchPermission(storedOwnerId);
  if (!hasScopeAccess(permission)) {
    clearActiveView();
    return {
      ownUser,
      ownUserId: ownUser.id,
      activeUserId: ownUser.id,
      activeView: null,
      activeLabel: ownUser.email ?? "Minha conta",
      readOnly: false
    };
  }

  return {
    ownUser,
    ownUserId: ownUser.id,
    activeUserId: permission.owner_user_id,
    activeView: permission,
    activeLabel: permission.label,
    readOnly: true
  };
}

async function getActiveUserId(scope) {
  const activeView = await getActiveView();

  if (!activeView.readOnly) {
    return activeView.activeUserId;
  }

  return hasScopeAccess(activeView.activeView, scope) ? activeView.activeUserId : activeView.ownUserId;
}

async function listVisibleCalendarUserIds() {
  ensureClient();
  const ownUserId = await getOwnUserId();
  if (!ownUserId) {
    return [];
  }

  const { data, error } = await supabase
    .from("account_view_permissions")
    .select("owner_user_id")
    .eq("viewer_user_id", ownUserId)
    .eq("can_view_calendar", true);

  if (error) {
    throw error;
  }

  return [...new Set([ownUserId, ...(data ?? []).map((permission) => permission.owner_user_id).filter(Boolean)])];
}

async function setActiveView(ownerUserId) {
  const permission = await fetchPermission(ownerUserId);
  if (!permission) {
    clearActiveView();
    throw new Error("Visualização compartilhada indisponível.");
  }

  window.localStorage.setItem(ACTIVE_VIEW_OWNER_KEY, permission.owner_user_id);
  return getActiveView();
}

function clearActiveView() {
  window.localStorage.removeItem(ACTIVE_VIEW_OWNER_KEY);
}

async function isViewingSharedAccount() {
  return (await getActiveView()).readOnly;
}

async function isReadOnly() {
  return isViewingSharedAccount();
}

async function ensureCanEdit() {
  if (await isReadOnly()) {
    throw new Error(READ_ONLY_ERROR);
  }
}

export default {
  getOwnUser,
  getOwnUserId,
  getActiveView,
  getActiveUserId,
  listVisibleCalendarUserIds,
  listAvailableViews,
  setActiveView,
  clearActiveView,
  isViewingSharedAccount,
  isReadOnly,
  ensureCanEdit
};
