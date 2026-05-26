import { formatReminderLabel, formatTimeLabel } from "../utils/dates.js";

function formatEventDateLabel(isoDate) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short"
  }).format(new Date(`${isoDate}T12:00:00`));
}

export function eventCard(event, { isSelectionMode = false, isSelected = false, showDate = false } = {}) {
  const metaItems = [
    showDate ? `<span class="pill">📅 ${formatEventDateLabel(event.event_date)}</span>` : "",
    event.event_time ? `<span class="pill">⏰ ${formatTimeLabel(event.event_time)}</span>` : "",
    event.reminder_minutes ? `<span class="pill">🔔 ${formatReminderLabel(event.reminder_minutes)}</span>` : ""
  ].filter(Boolean);

  return `
    <article
      class="card event-card ${isSelectionMode ? "is-selection-mode" : ""} ${isSelected ? "is-selected" : ""}"
      data-event-id="${event.id}"
    >
      <div class="event-card__top">
        <div class="event-card__content">
          <h3 class="event-card__title">${event.title}</h3>
          ${metaItems.length ? `<div class="event-card__meta">${metaItems.join("")}</div>` : ""}
        </div>
        <button class="icon-button event-card__menu icon-dots" data-action="edit-event" data-id="${event.id}" aria-label="Editar evento"></button>
      </div>
    </article>
  `;
}
