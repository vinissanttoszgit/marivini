export function loadingState() {
  return `
    <div class="card loading-state">
      <div class="loading-state__header">
        <div class="loading-state__line loading-state__line--title"></div>
        <div class="loading-state__line loading-state__line--pill"></div>
      </div>
      <div class="loading-state__line loading-state__line--body"></div>
      <div class="loading-state__line loading-state__line--body loading-state__line--short"></div>
    </div>
  `;
}
