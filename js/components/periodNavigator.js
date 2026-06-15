export function periodNavigator({
  label = "",
  ariaLabel = "",
  prevId = "",
  nextId = "",
  resetId = "",
  prevAriaLabel = "Anterior",
  nextAriaLabel = "Proximo",
  resetAriaLabel = "",
  className = "card habit-date-nav",
  labelClassName = "habit-date-nav__label habit-date-nav__label-button",
  disabled = false
} = {}) {
  const disabledAttribute = disabled ? " disabled" : "";

  return `
    <section class="${className}" aria-label="${ariaLabel}">
      <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--prev" id="${prevId}" type="button" aria-label="${prevAriaLabel}"${disabledAttribute}></button>
      <button class="${labelClassName}" id="${resetId}" type="button" aria-label="${resetAriaLabel || ariaLabel}"${disabledAttribute}>${label}</button>
      <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--next" id="${nextId}" type="button" aria-label="${nextAriaLabel}"${disabledAttribute}></button>
    </section>
  `;
}
