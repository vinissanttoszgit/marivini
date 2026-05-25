import { button } from "../components/button.js";
import { applyThemePreset, getSavedThemePreset, THEME_PRESETS } from "../config/theme.js";
import authService from "../services/authService.js";

export async function openSettingsModal(context) {
  const user = await authService.getUser();
  const activeTheme = getSavedThemePreset();

  context.modal.open({
    title: "Configurações",
    description: "",
    content: `
      <div class="form-stack">
        <div class="card settings-block">
          <p class="eyebrow">Tema</p>
          <div class="theme-picker">
            ${THEME_PRESETS.map(
              (preset) => `
                <button
                  class="theme-swatch ${preset.id === activeTheme ? "is-active" : ""}"
                  type="button"
                  data-theme-id="${preset.id}"
                  aria-label="Selecionar tema ${preset.label}"
                >
                  <span class="theme-swatch__dot" style="background:${preset.swatch};"></span>
                  <span class="theme-swatch__label">${preset.label}</span>
                </button>
              `
            ).join("")}
          </div>
        </div>
        <div class="card settings-block">
          <p class="eyebrow">Conta</p>
          <h3>${user?.email ?? "Usuário"}</h3>
          ${button("Sair da conta", "danger", 'type="button" id="logout-button"')}
        </div>
      </div>
    `
  });

  document.querySelectorAll("[data-theme-id]").forEach((element) => {
    element.addEventListener("click", () => {
      applyThemePreset(element.dataset.themeId);
      context.modal.close();
      context.toast.success("Tema atualizado.");
      openSettingsModal(context);
    });
  });

  document.querySelector("#logout-button").addEventListener("click", async () => {
    try {
      await authService.signOut();
      window.location.replace("./login.html");
    } catch (error) {
      context.toast.error(error.message || "Não foi possível sair da conta.");
    }
  });
}
