export function progressCard({ completed, total, label = "", hint = "", interactive = false, attributes = "" }) {
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  const tagName = interactive ? "button" : "section";
  const resolvedAttributes = interactive ? `type="button" ${attributes}`.trim() : attributes;

  return `
    <${tagName} class="card progress-card ${interactive ? "progress-card--interactive" : ""}" ${resolvedAttributes}>
      <div class="progress-card__top">
        <div>
          ${label ? `<p class="eyebrow">${label}</p>` : ""}
          <div class="progress-card__value">${percentage}%</div>
        </div>
        <div class="pill">${completed}/${total} concluidos</div>
      </div>
      <div class="progress-bar">
        <div class="progress-bar__fill" style="width: ${percentage}%"></div>
      </div>
      ${
        hint
          ? `<div class="progress-card__action">
              <span>${hint}</span>
              <span class="progress-card__action-icon icon-arrow-right" aria-hidden="true"></span>
            </div>`
          : ""
      }
    </${tagName}>
  `;
}
