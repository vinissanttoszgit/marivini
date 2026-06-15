import { eventCardSkeleton } from "./eventCardSkeleton.js";
import { sectionDivider } from "./sectionDivider.js";

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

  if (variant === "calendar") {
    return `
      <div class="loading-state loading-state--calendar" aria-hidden="true">
        <section class="card calendar-card loading-state__calendar-card">
          <div class="calendar-header calendar-header--loading">
            <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--prev" type="button" aria-label="Mês anterior" disabled></button>
            <div class="loading-state__line loading-state__line--calendar-month"></div>
            <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--next" type="button" aria-label="Próximo mês" disabled></button>
          </div>
          <div class="loading-state__calendar-grid">
            ${Array.from({ length: 7 }, () => '<div class="loading-state__calendar-weekday"></div>').join("")}
            ${Array.from({ length: 42 }, (_, index) => calendarDayLoadingState(index)).join("")}
          </div>
        </section>
        <section class="loading-state__calendar-section" aria-label="Carregando eventos do dia">
          <article class="card event-card loading-state__event-card">
            ${eventCardSkeleton({ article: false })}
          </article>
        </section>
        <section class="loading-state__calendar-section" aria-label="Carregando próximos eventos">
          ${sectionDivider({ label: "Próximos eventos", className: "events-section-divider loading-state__calendar-divider" })}
          <div class="events-list">
            ${Array.from({ length: 2 }, () => eventCardSkeleton({ showDate: true })).join("")}
          </div>
        </section>
      </div>
    `;
  }

  if (variant === "weeklySummary") {
    return `
      <div class="loading-state loading-state--weekly-summary" aria-hidden="true">
        <section class="card habit-date-nav habit-date-nav--loading" aria-label="Navegar semanas">
          <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--prev" type="button" aria-label="Semana anterior" disabled></button>
          <div class="habit-date-nav__label">${dateLabel}</div>
          <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--next" type="button" aria-label="Proxima semana" disabled></button>
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
        <section class="card loading-state__weekly-summary-card">
          <div class="loading-state__weekly-summary-chart">
            ${Array.from({ length: 7 }, () => weeklySummaryRowLoadingState()).join("")}
          </div>
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

function calendarDayLoadingState(index) {
  const isOutside = index < 4 || index > 33;

  return `
    <div class="loading-state__calendar-day ${isOutside ? "is-outside" : ""}">
      <div class="loading-state__line loading-state__line--calendar-day-number"></div>
      <div class="loading-state__calendar-day-dot"></div>
    </div>
  `;
}

function weeklySummaryRowLoadingState() {
  return `
    <div class="loading-state__weekly-summary-row">
      <div class="loading-state__line loading-state__line--weekly-day"></div>
      <div class="loading-state__weekly-summary-bar-group">
        <div class="loading-state__weekly-summary-meta">
          <div class="loading-state__line loading-state__line--weekly-meta"></div>
          <div class="loading-state__line loading-state__line--weekly-meta"></div>
        </div>
        <div class="loading-state__line loading-state__line--weekly-progress"></div>
      </div>
    </div>
  `;
}
