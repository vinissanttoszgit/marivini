import { button } from "../components/button.js";
import { applyThemePreset, getSavedThemePreset, THEME_PRESETS } from "../config/theme.js";
import authService from "../services/authService.js";

export async function openSettingsModal(context) {
  const user = await authService.getUser();
  const activeTheme = getSavedThemePreset();

  context.modal.open({
    title: "Configuracoes",
    description: "Perfil, sessao e aparencia do app.",
    content: `
      <div class="form-stack">
        <div class="card settings-block">
          <p class="eyebrow">Conta</p>
          <h3>${user?.email ?? "Usuario"}</h3>
          <p>Login ativo com Supabase Auth.</p>
        </div>
        <div class="card settings-block">
          <p class="eyebrow">Tema</p>
          <p>Escolha a cor principal. O tema fica salvo neste navegador.</p>
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
          <p>Para trocar todos os tokens manualmente, edite <strong>/css/variables.css</strong>.</p>
        </div>
      </div>
    `,
    footer: `
      ${button("Fechar", "ghost", 'type="button" data-close-modal')}
      ${button("Sair da conta", "danger", 'type="button" id="logout-button"')}
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
      context.toast.error(error.message || "Nao foi possivel sair da conta.");
    }
  });
}
