import authService from "./services/authService.js";
import viewContextService from "./services/viewContextService.js";
import { isSupabaseConfigured } from "./config/supabase.js";
import { initializeTheme } from "./config/theme.js";
import { createNavbar } from "./components/navbar.js";
import { Modal } from "./components/modal.js";
import { Toast } from "./components/toast.js";
import { createHabitsPage } from "./pages/habitsPage.js";
import { createCalendarPage } from "./pages/calendarPage.js";
import { openSettingsModal } from "./pages/settingsPage.js";
import { qs, setText } from "./utils/dom.js";

const ACTIVE_TAB_KEY = "marivini:active-tab";
const pageRoot = qs("#page-root");
const navRoot = qs("#bottom-nav");
const pageEyebrow = qs("#page-eyebrow");
const pageTitle = qs("#page-title");
const pageSubtitle = qs("#page-subtitle");
const modal = new Modal();
const toast = new Toast();
let currentViewContext = {
  readOnly: false,
  activeUserId: null,
  activeView: null,
  activeLabel: ""
};

const context = {
  modal,
  toast,
  root: pageRoot,
  getViewContext() {
    return currentViewContext;
  },
  isReadOnly() {
    return Boolean(currentViewContext.readOnly);
  },
  async refreshApp() {
    await refreshViewContext();
    renderNav();
    await renderCurrentTab();
  },
  setHeader({ eyebrow, title, subtitle }) {
    setText("#page-eyebrow", eyebrow);
    setText("#page-title", title);
    setText("#page-subtitle", subtitle);
    pageEyebrow.hidden = !eyebrow;
    pageTitle.classList.toggle("page-title--flush", !eyebrow);
    pageSubtitle.hidden = !subtitle;
  }
};

const pages = {
  habits: createHabitsPage(context),
  calendar: createCalendarPage(context)
};

let activeTab = getStoredTab();

setInitialShell(activeTab);

init();

async function init() {
  initializeTheme();

  if (!isSupabaseConfigured) {
    toast.error("Preencha a URL e a ANON KEY do Supabase antes de usar o app.");
  }

  const session = await authService.getSession();
  if (!session) {
    window.location.replace("./login.html");
    return;
  }

  bindGlobalActions();
  await refreshViewContext();
  renderNav();
  await renderCurrentTab();

  authService.onAuthStateChange((nextSession) => {
    if (!nextSession) {
      window.location.replace("./login.html");
    }
  });
}

function bindGlobalActions() {
  qs("#header-add-habit-trigger").addEventListener("click", () => {
    if (context.isReadOnly()) {
      return;
    }

    if (activeTab === "habits") {
      pages.habits.openCreateHabitModal();
      return;
    }

    if (activeTab === "calendar") {
      pages.calendar.openCreateEventModal();
    }
  });
}

function renderNav() {
  syncHeaderAddButton();
  navRoot.innerHTML = "";
  navRoot.appendChild(
    createNavbar({
      activeTab,
      onOpenSettings: () => openSettingsModal(context),
      onNavigate: async (tab) => {
        activeTab = tab;
        storeTab(tab);
        renderNav();
        await renderCurrentTab();
      }
    })
  );
}

async function renderCurrentTab() {
  syncHeaderAddButton();
  await pages[activeTab].render(pageRoot);
}

async function refreshViewContext() {
  currentViewContext = await viewContextService.getActiveView();
  syncHeaderAddButton();
}

function syncHeaderAddButton() {
  const addButton = qs("#header-add-habit-trigger");
  const readOnly = context.isReadOnly();
  addButton.hidden = readOnly;
  addButton.disabled = readOnly;
  addButton.setAttribute("aria-hidden", String(readOnly));
}

function getStoredTab() {
  const storedTab = window.localStorage.getItem(ACTIVE_TAB_KEY);
  return storedTab === "calendar" ? "calendar" : "habits";
}

function storeTab(tab) {
  window.localStorage.setItem(ACTIVE_TAB_KEY, tab);
}

function setInitialShell(tab) {
  if (tab === "calendar") {
    context.setHeader({
      eyebrow: "",
      title: "Calendário",
      subtitle: ""
    });
  } else {
    context.setHeader({
      eyebrow: "",
      title: "Hábitos",
      subtitle: ""
    });
  }
}
