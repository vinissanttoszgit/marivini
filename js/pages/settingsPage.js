import { button } from "../components/button.js";
import { applyThemePreset, getSavedThemePreset, THEME_PRESETS } from "../config/theme.js";
import authService from "../services/authService.js";
import viewContextService from "../services/viewContextService.js";

export async function openSettingsModal(context) {
  const user = await authService.getUser();
  const activeTheme = getSavedThemePreset();
  const viewContext = await viewContextService.getActiveView();
  const availableViews = await viewContextService.listAvailableViews();
  const inactiveViews = availableViews.filter(
    (view) => String(view.owner_user_id) !== String(viewContext.activeUserId)
  );

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
        </div>
        <div class="card settings-block settings-view-block">
          <div class="settings-view-block__header">
            <p class="eyebrow">Visualização</p>
            ${viewContext.readOnly ? '<span class="settings-view-badge">Somente visualização</span>' : ""}
          </div>
          ${
            viewContext.readOnly
              ? `
                <div class="settings-view-card">
                  <span>Visualizando conta</span>
                  <strong>${viewContext.activeLabel}</strong>
                </div>
                ${button("Voltar para minha conta", "secondary", 'type="button" id="clear-shared-view"')}
              `
              : `
                <div class="settings-view-card">
                  <span>Conta atual</span>
                  <strong>${user?.email ?? "Minha conta"}</strong>
                </div>
                ${
                  inactiveViews.length
                    ? inactiveViews
                        .map((view) =>
                          button(
                            `Ver conta de ${view.label}`,
                            "secondary",
                            `type="button" data-view-owner-id="${view.owner_user_id}"`
                          )
                        )
                        .join("")
                    : ""
                }
              `
          }
        </div>
        ${button("Sair da conta", "danger", 'type="button" id="logout-button"')}
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

  document.querySelectorAll("[data-view-owner-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      try {
        await viewContextService.setActiveView(element.dataset.viewOwnerId);
        context.modal.close();
        await context.refreshApp();
        context.toast.success("Visualização alterada.");
      } catch (error) {
        context.toast.error(error.message || "Não foi possível alterar a visualização.");
      }
    });
  });

  document.querySelector("#clear-shared-view")?.addEventListener("click", async () => {
    viewContextService.clearActiveView();
    context.modal.close();
    await context.refreshApp();
    context.toast.success("Você voltou para sua conta.");
  });

  document.querySelector("#logout-button").addEventListener("click", async () => {
    try {
      viewContextService.clearActiveView();
      await authService.signOut();
      window.location.replace("./login.html");
    } catch (error) {
      context.toast.error(error.message || "Não foi possível sair da conta.");
    }
  });
}
