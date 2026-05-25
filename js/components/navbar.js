export function createNavbar({ activeTab, onNavigate, onOpenSettings }) {
  const nav = document.createElement("div");
  nav.className = "bottom-nav";
  nav.innerHTML = `
    <div class="bottom-nav__list">
      <button class="bottom-nav__item ${activeTab === "habits" ? "is-active" : ""}" data-tab="habits">
        <span>Hábitos</span>
      </button>
      <button class="bottom-nav__item ${activeTab === "calendar" ? "is-active" : ""}" data-tab="calendar">
        <span>Calendário</span>
      </button>
      <button class="bottom-nav__item bottom-nav__item--icon" data-action="settings" aria-label="Configurações">
        <span class="bottom-nav__icon-glyph">⚙️</span>
      </button>
    </div>
  `;

  nav.addEventListener("click", (event) => {
    const settingsTarget = event.target.closest("[data-action='settings']");
    if (settingsTarget) {
      onOpenSettings();
      return;
    }

    const tabTarget = event.target.closest("[data-tab]");
    if (!tabTarget) {
      return;
    }

    onNavigate(tabTarget.dataset.tab);
  });

  return nav;
}
