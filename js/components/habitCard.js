function getCompactStatus(streakData) {
  if (streakData.missedTwoDaysRisk) {
    return "Não falhar";
  }

  if (streakData.missedYesterday) {
    return "Retomar";
  }

  return "Pendente";
}

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
      <div class="habit-card__body">
        <div class="habit-card__top">
          <div class="habit-card__icon">${habit.icon || "✨"}</div>
          <h3 class="habit-card__title">${habit.title}</h3>
        </div>
        <div class="habit-card__footer">
          <div class="habit-card__footer-left">
            <span class="habit-card__streak">🔥 ${streakData.currentStreak} dias</span>
            ${activeDaysLabel ? `<span class="habit-card__days">${activeDaysLabel}</span>` : ""}
          </div>
          <span class="habit-card__status ${statusClass}">${getCompactStatus(streakData)}</span>
        </div>
      </div>
      <div class="habit-card__actions">
        <button class="icon-button habit-card__menu" data-action="edit" data-id="${habit.id}" aria-label="Abrir opções do hábito">⋯</button>
      </div>
    </article>
  `;
}
