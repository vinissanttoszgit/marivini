import authService from "./services/authService.js";
import { isSupabaseConfigured } from "./config/supabase.js";
import { initializeTheme } from "./config/theme.js";
import { createNavbar } from "./components/navbar.js";
import { Modal } from "./components/modal.js";
import { Toast } from "./components/toast.js";
import { createHabitsPage } from "./pages/habitsPage.js";
import { createCalendarPage } from "./pages/calendarPage.js";
import { openSettingsModal } from "./pages/settingsPage.js";
import { qs, setText } from "./utils/dom.js";

const pageRoot = qs("#page-root");
const navRoot = qs("#bottom-nav");
const modal = new Modal();
const toast = new Toast();

const context = {
  modal,
  toast,
  root: pageRoot,
  setHeader({ eyebrow, title, subtitle }) {
    setText("#page-eyebrow", eyebrow);
    setText("#page-title", title);
    setText("#page-subtitle", subtitle);
  }
};

const pages = {
  habits: createHabitsPage(context),
  calendar: createCalendarPage(context)
};

let activeTab = "habits";

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
  renderNav();
  await renderCurrentTab();

  authService.onAuthStateChange((nextSession) => {
    if (!nextSession) {
      window.location.replace("./login.html");
    }
  });
}

function bindGlobalActions() {
  qs("#settings-trigger").addEventListener("click", () => openSettingsModal(context));
}

function renderNav() {
  navRoot.innerHTML = "";
  navRoot.appendChild(
    createNavbar({
      activeTab,
      onNavigate: async (tab) => {
        activeTab = tab;
        renderNav();
        await renderCurrentTab();
      }
    })
  );
}

async function renderCurrentTab() {
  await pages[activeTab].render(pageRoot);
}
