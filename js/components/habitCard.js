export function habitCard({ habit, isCompleted, streakData, activeDaysLabel = "", isSelectionMode = false, isSelected = false }) {
  const statusClass = streakData.missedTwoDaysRisk
    ? "status-risk"
    : streakData.missedYesterday
      ? "status-warning"
      : "status-safe";

  return `
    <article
      class="card habit-card ${isCompleted ? "is-complete" : ""} ${isSelectionMode ? "is-selection-mode" : ""} ${isSelected ? "is-selected" : ""}"
      data-habit-id="${habit.id}"
      tabindex="0"
      role="button"
      aria-pressed="${isSelectionMode ? isSelected : isCompleted}"
      aria-label="${isSelectionMode ? `Selecionar ${habit.title}` : `Marcar hábito ${habit.title}`}"
    >
      <div class="habit-card__check" aria-hidden="true">
        ${isSelectionMode ? (isSelected ? "✓" : "") : isCompleted ? "✓" : ""}
      </div>
      <div class="habit-card__content">
        <div class="habit-card__icon">${habit.icon || "✨"}</div>
        <div class="habit-card__main">
          <h3 class="habit-card__title">${habit.title}</h3>
          ${habit.description ? `<p class="habit-card__description">${habit.description}</p>` : ""}
          <div class="habit-card__meta">
            <div class="habit-card__badges">
              <span class="pill">🔥 ${streakData.currentStreak} dias</span>
              <span class="${statusClass}">${streakData.statusLabel}</span>
            </div>
            ${activeDaysLabel ? `<p class="habit-card__days">${activeDaysLabel}</p>` : ""}
          </div>
        </div>
      </div>
      <div class="habit-card__actions">
        <button class="icon-button habit-card__menu" data-action="edit" data-id="${habit.id}" aria-label="Abrir opções do hábito">⋯</button>
      </div>
    </article>
  `;
}
