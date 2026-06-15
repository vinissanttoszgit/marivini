import { button } from "./button.js";

export function selectionActionBar({
  ariaLabel = "",
  className = "",
  cancelLabel = "Cancelar",
  cancelId = "",
  deleteLabel = "",
  deleteId = "",
  deleteDisabled = false,
  deleteVariant = "danger"
} = {}) {
  return `
    <section class="${className}" aria-label="${ariaLabel}">
      ${button(cancelLabel, "ghost", `type="button" id="${cancelId}"`)}
      ${button(deleteLabel, deleteVariant, `type="button" id="${deleteId}" ${deleteDisabled ? "disabled" : ""}`)}
    </section>
  `;
}
