export function titleIconPicker({
  prefix = "",
  label = "",
  titleName = "title",
  titleValue = "",
  titlePlaceholder = "",
  titleMaxLength = 80,
  titleRequired = false,
  selectedIcon = "",
  iconOptions = [],
  defaultIcon = ""
} = {}) {
  const icon = selectedIcon || defaultIcon;
  const requiredAttribute = titleRequired ? " required" : "";

  return `
    <div class="${prefix}-title-group">
      <label>
        ${label}
        <div class="${prefix}-title-field">
          <input name="${titleName}" maxlength="${titleMaxLength}" value="${titleValue}" placeholder="${titlePlaceholder}"${requiredAttribute} />
          <button
            type="button"
            class="${prefix}-icon-trigger"
            id="${prefix}-icon-trigger"
            aria-label="Escolher ícone"
            aria-expanded="false"
          >
            <span id="selected-${prefix}-icon">${icon}</span>
          </button>
          <input type="hidden" name="icon" value="${icon}" />
        </div>
      </label>
      <div class="${prefix}-icon-picker" id="${prefix}-icon-picker" hidden>
        ${iconOptions
          .map(
            (emoji) => `
              <button
                type="button"
                class="${prefix}-icon-option ${icon === emoji ? "is-selected" : ""}"
                data-icon="${emoji}"
                aria-label="Selecionar ícone ${emoji}"
              >
                ${emoji}
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}
