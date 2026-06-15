export function sectionDivider({ label = "", className = "events-section-divider", attributes = "" } = {}) {
  return `
    <div class="${className}" ${attributes}>
      <span>${label}</span>
    </div>
  `;
}
