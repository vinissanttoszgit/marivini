export class Toast {
  constructor(rootSelector = "#toast-root") {
    this.root = document.querySelector(rootSelector);
    this.stack = document.createElement("div");
    this.stack.className = "toast-stack";
    this.root.appendChild(this.stack);
  }

  show(message, type = "default") {
    const item = document.createElement("div");
    item.className = `toast ${type === "success" ? "toast-success" : ""} ${type === "error" ? "toast-error" : ""}`.trim();
    item.textContent = message;
    this.stack.appendChild(item);

    window.setTimeout(() => {
      item.remove();
    }, 3200);
  }

  success(message) {
    this.show(message, "success");
  }

  error(message) {
    this.show(message, "error");
  }
}
