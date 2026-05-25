export function progressCard({ completed, total, label = "" }) {
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  return `
    <section class="card progress-card">
      <div class="progress-card__top">
        <div>
          ${label ? `<p class="eyebrow">${label}</p>` : ""}
          <div class="progress-card__value">${percentage}%</div>
        </div>
        <div class="pill">${completed}/${total} concluídos</div>
      </div>
      <p class="progress-card__meta">Mantenha o ritmo e feche o dia com sua rotina em dia.</p>
      <div class="progress-bar">
        <div class="progress-bar__fill" style="width: ${percentage}%"></div>
      </div>
    </section>
  `;
}
