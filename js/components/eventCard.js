import { formatReminderLabel, formatTimeLabel } from "../utils/dates.js";

export function eventCard(event) {
  return `
    <article class="card event-card">
      <div class="event-card__top">
        <div>
          <h3 class="event-card__title">${event.title}</h3>
          ${event.description ? `<p>${event.description}</p>` : ""}
        </div>
        <div class="inline-actions" style="grid-template-columns:repeat(2, 44px); gap:8px;">
          <button class="icon-button" data-action="edit-event" data-id="${event.id}" aria-label="Editar evento">✎</button>
          <button class="icon-button" data-action="delete-event" data-id="${event.id}" aria-label="Excluir evento">🗑</button>
        </div>
      </div>
      <div class="event-card__meta">
        ${event.event_time ? `<span class="pill">⏰ ${formatTimeLabel(event.event_time)}</span>` : ""}
        ${event.reminder_minutes ? `<span class="pill">🔔 ${formatReminderLabel(event.reminder_minutes)}</span>` : ""}
      </div>
    </article>
  `;
}
