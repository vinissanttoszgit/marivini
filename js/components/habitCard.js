export function habitCard({
  habit,
  isCompleted,
  streakData,
  isSelectionMode = false,
  isSelected = false,
  canEdit = true
}) {
  return `
    <article
      class="card habit-card ${streakData.missedTwoDaysRisk ? "is-risk" : ""} ${isCompleted ? "is-complete" : ""} ${isSelectionMode ? "is-selection-mode" : ""} ${isSelected ? "is-selected" : ""} ${canEdit ? "" : "is-read-only"}"
      data-habit-id="${habit.id}"
      ${canEdit ? 'tabindex="0" role="button"' : ""}
      ${canEdit ? `aria-pressed="${isSelectionMode ? isSelected : isCompleted}"` : ""}
      aria-label="${canEdit ? (isSelectionMode ? `Selecionar ${habit.title}` : `Marcar hábito ${habit.title}`) : habit.title}"
    >
      <div class="habit-card__main-row">
        <div class="habit-card__check" aria-hidden="true">
          ${isSelectionMode ? (isSelected ? "✓" : "") : isCompleted ? "✓" : ""}
        </div>
        <div class="habit-card__body">
          <div class="habit-card__icon">${habit.icon || "✨"}</div>
          <div class="habit-card__text">
            <h3 class="habit-card__title">${habit.title}</h3>
          </div>
        </div>
        ${
          canEdit
            ? `<div class="habit-card__actions">
                <button class="icon-button habit-card__menu icon-dots" data-action="edit" data-id="${habit.id}" aria-label="Abrir opções do hábito"></button>
              </div>`
            : ""
        }
      </div>
    </article>
  `;
}
