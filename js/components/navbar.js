export function createNavbar({ activeTab, onNavigate }) {
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
    </div>
  `;

  nav.addEventListener("click", (event) => {
    const target = event.target.closest("[data-tab]");
    if (!target) {
      return;
    }

    onNavigate(target.dataset.tab);
  });

  return nav;
}
