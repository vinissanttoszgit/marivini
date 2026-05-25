function getCompactStatus(streakData, isCompleted) {
  if (streakData.missedTwoDaysRisk) {
    return "Não falhar";
  }

  return isCompleted ? "Feito" : "Pendente";
}

export function habitCard({ habit, isCompleted, streakData, isSelectionMode = false, isSelected = false }) {
  const statusClass = streakData.missedTwoDaysRisk ? "status-risk" : "status-safe";

  return `
    <article
      class="card habit-card ${isCompleted ? "is-complete" : ""} ${isSelectionMode ? "is-selection-mode" : ""} ${isSelected ? "is-selected" : ""}"
      data-habit-id="${habit.id}"
      tabindex="0"
      role="button"
      aria-pressed="${isSelectionMode ? isSelected : isCompleted}"
      aria-label="${isSelectionMode ? `Selecionar ${habit.title}` : `Marcar hábito ${habit.title}`}"
    >
      <div class="habit-card__main-row">
        <div class="habit-card__check" aria-hidden="true">
          ${isSelectionMode ? (isSelected ? "✓" : "") : isCompleted ? "✓" : ""}
        </div>
        <div class="habit-card__body">
          <div class="habit-card__icon">${habit.icon || "✨"}</div>
          <h3 class="habit-card__title">${habit.title}</h3>
        </div>
        <div class="habit-card__actions">
          <button class="icon-button habit-card__menu" data-action="edit" data-id="${habit.id}" aria-label="Abrir opções do hábito">⋯</button>
        </div>
      </div>
      <div class="habit-card__footer">
        <div class="habit-card__footer-right">
          <span class="habit-card__chip habit-card__status ${statusClass}">${getCompactStatus(streakData, isCompleted)}</span>
          <span class="habit-card__chip habit-card__streak">🔥 ${streakData.currentStreak} dias</span>
        </div>
      </div>
    </article>
  `;
}
