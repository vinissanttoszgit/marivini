export function eventCardSkeleton({
  showDate = false,
  article = true,
  className = "card event-card loading-state__event-card"
} = {}) {
  const content = `
    <div class="event-card__top">
      <div class="event-card__body">
        <div class="loading-state__event-icon"></div>
        <div class="event-card__content">
          <div class="loading-state__line loading-state__line--event-title"></div>
          <div class="loading-state__event-meta">
            ${showDate ? '<div class="loading-state__line loading-state__line--event-date"></div>' : ""}
            <div class="loading-state__line loading-state__line--event-time"></div>
          </div>
        </div>
      </div>
      <div class="loading-state__event-action"></div>
    </div>
  `;

  if (!article) {
    return content;
  }

  return `
    <article class="${className}">
      ${content}
    </article>
  `;
}
