import { button } from "./button.js";

export function modalFooterActions({
  cancelLabel = "Cancelar",
  cancelVariant = "ghost",
  cancelAttributes = 'type="button" data-close-modal',
  actionLabel = "",
  actionVariant = "primary",
  actionAttributes = ""
} = {}) {
  return `
    ${button(cancelLabel, cancelVariant, cancelAttributes)}
    ${button(actionLabel, actionVariant, actionAttributes)}
  `;
}
