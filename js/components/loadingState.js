export function loadingState(message = "Carregando...") {
  return `
    <div class="card loading-state">
      <div class="loading-state__spinner"></div>
      <p>${message}</p>
    </div>
  `;
}
