export function loadingState({ variant = "default", dateLabel = "Hoje" } = {}) {
  if (variant === "habits") {
    return `
      <div class="loading-state loading-state--habit" aria-hidden="true">
        <section class="card habit-date-nav habit-date-nav--loading" aria-label="Selecionar data">
          <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--prev" type="button" aria-label="Dia anterior" disabled></button>
          <div class="habit-date-nav__label">${dateLabel}</div>
          <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--next" type="button" aria-label="Próximo dia" disabled></button>
        </section>
        <section class="card progress-card loading-state__habit-progress">
          <div class="progress-card__top">
            <div class="loading-state__habit-progress-copy">
              <div class="loading-state__line loading-state__line--percentage"></div>
            </div>
            <div class="loading-state__line loading-state__line--pill"></div>
          </div>
          <div class="loading-state__line loading-state__line--progress"></div>
        </section>
        <section class="habit-list" aria-label="Carregando hábitos">
          ${Array.from({ length: 3 }, () => habitCardLoadingState()).join("")}
        </section>
      </div>
    `;
  }

  return `
    <div class="card loading-state">
      <div class="loading-state__header">
        <div class="loading-state__line loading-state__line--title"></div>
        <div class="loading-state__line loading-state__line--pill"></div>
      </div>
      <div class="loading-state__line loading-state__line--body"></div>
      <div class="loading-state__line loading-state__line--body loading-state__line--short"></div>
    </div>
  `;
}

function habitCardLoadingState() {
  return `
    <article class="card habit-card loading-state__habit-card">
      <div class="habit-card__main-row">
        <div class="loading-state__habit-check"></div>
        <div class="habit-card__body">
          <div class="loading-state__habit-icon"></div>
          <div class="habit-card__text">
            <div class="loading-state__line loading-state__line--habit-title"></div>
            <div class="loading-state__line loading-state__line--habit-meta"></div>
          </div>
        </div>
        <div class="loading-state__habit-actions">
          <div class="loading-state__habit-action"></div>
          <div class="loading-state__habit-action"></div>
        </div>
      </div>
    </article>
  `;
}
