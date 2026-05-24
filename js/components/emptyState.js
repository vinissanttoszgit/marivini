export function emptyState({ icon = "✨", title, description, action = "" }) {
  return `
    <div class="card empty-state">
      <div class="empty-state__icon">${icon}</div>
      <h3>${title}</h3>
      <p>${description}</p>
      ${action ? `<div style="margin-top: 16px;">${action}</div>` : ""}
    </div>
  `;
}
