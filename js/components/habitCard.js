export function habitCard({ habit, isCompleted, streakData }) {
  const statusClass = streakData.missedTwoDaysRisk
    ? "status-risk"
    : streakData.missedYesterday
      ? "status-warning"
      : "status-safe";

  return `
    <article class="card habit-card">
      <button class="habit-card__check ${isCompleted ? "is-complete" : ""}" data-action="toggle" data-id="${habit.id}" aria-label="Marcar hábito">
        ${isCompleted ? "✓" : ""}
      </button>
      <div style="display:grid; grid-template-columns:auto 1fr; gap:12px; align-items:center;">
        <div class="habit-card__icon">${habit.icon || "✨"}</div>
        <div class="habit-card__main">
          <h3 class="habit-card__title">${habit.title}</h3>
          ${habit.description ? `<p class="habit-card__description">${habit.description}</p>` : ""}
          <div class="habit-card__badges">
            <span class="pill">🔥 ${streakData.currentStreak} dias</span>
            <span class="${statusClass}">${streakData.statusLabel}</span>
          </div>
        </div>
      </div>
      <div class="habit-card__actions">
        <button class="icon-button" data-action="edit" data-id="${habit.id}" aria-label="Editar hábito">✎</button>
        <button class="icon-button" data-action="delete" data-id="${habit.id}" aria-label="Excluir hábito">🗑</button>
      </div>
    </article>
  `;
}
