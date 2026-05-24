export class Modal {
  constructor(rootSelector = "#modal-root") {
    this.root = document.querySelector(rootSelector);
    this.currentOverlay = null;
  }

  open({ title, description = "", content = "", footer = "" }) {
    this.close();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal__handle"></div>
        <div class="modal__header">
          <div>
            <h2 class="modal__title" id="modal-title">${title}</h2>
            ${description ? `<p class="modal__description">${description}</p>` : ""}
          </div>
          <button class="icon-button" data-close-modal aria-label="Fechar modal">✕</button>
        </div>
        <div class="modal__body">${content}</div>
        ${footer ? `<div class="modal__footer">${footer}</div>` : ""}
      </div>
    `;

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest("[data-close-modal]")) {
        this.close();
      }
    });

    this.root.appendChild(overlay);
    this.currentOverlay = overlay;
    document.body.style.overflow = "hidden";
  }

  close() {
    if (!this.currentOverlay) {
      return;
    }

    this.currentOverlay.remove();
    this.currentOverlay = null;
    document.body.style.overflow = "";
  }
}
