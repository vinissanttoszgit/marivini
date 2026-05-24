export const qs = (selector, parent = document) => parent.querySelector(selector);
export const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];

export function setText(selector, text, parent = document) {
  const node = qs(selector, parent);
  if (node) {
    node.textContent = text;
  }
}
