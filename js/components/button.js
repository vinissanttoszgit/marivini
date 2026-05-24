export function button(label, variant = "primary", attributes = "") {
  return `<button class="btn btn-${variant}" ${attributes}>${label}</button>`;
}
