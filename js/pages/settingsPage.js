import { button } from "../components/button.js";
import { applyThemePreset, getSavedThemePreset, THEME_PRESETS } from "../config/theme.js";
import authService from "../services/authService.js";
import notificationsService from "../services/notificationsService.js";
import viewContextService from "../services/viewContextService.js";

export async function openSettingsModal(context) {
  const user = await authService.getUser();
  const activeTheme = getSavedThemePreset();
  let viewContext;
  let availableViews = [];

  try {
    viewContext = await viewContextService.getActiveView();
  } catch {
    viewContextService.clearActiveView();
    viewContext = {
      activeUserId: user?.id ?? null,
      activeLabel: user?.email ?? "Minha conta",
      readOnly: false
    };
  }

  try {
    availableViews = await viewContextService.listAvailableViews();
  } catch {
    availableViews = [];
  }

  const inactiveViews = availableViews.filter(
    (view) => String(view.owner_user_id) !== String(viewContext.activeUserId)
  );
  const notificationsState = getNotificationsState();

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
        <div class="card settings-block">
          <p class="eyebrow">Notificações</p>
          <div class="settings-copy">
            <h3>Notificações</h3>
            <p>Ative notificações neste celular para receber lembretes do Marivini.</p>
          </div>
          ${renderNotificationsActions(notificationsState)}
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

  bindNotificationsActions(context);

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

function getNotificationsState() {
  const supported = notificationsService.isSupported();
  const permission = notificationsService.getPermissionState();
  const enabled = notificationsService.isEnabled();

  return {
    enabled,
    permission,
    supported
  };
}

function renderNotificationsActions({ supported, permission, enabled }) {
  if (!supported) {
    return '<p class="settings-feedback">Este navegador não oferece suporte para notificações neste dispositivo.</p>';
  }

  if (permission === "denied") {
    return `
      <p class="settings-feedback settings-feedback--warning">
        Notificações bloqueadas neste navegador. Libere a permissão nas configurações do dispositivo para ativar.
      </p>
    `;
  }

  if (!enabled) {
    return button("Ativar notificações neste celular", "primary", 'type="button" id="enable-notifications-button"');
  }

  return `
    <p class="settings-feedback settings-feedback--success">Notificações ativas neste celular.</p>
    ${button("Enviar notificação de teste", "secondary", 'type="button" id="send-test-notification-button"')}
    ${button("Desativar notificações neste celular", "ghost", 'type="button" id="disable-notifications-button"')}
  `;
}

function bindNotificationsActions(context) {
  document.querySelector("#enable-notifications-button")?.addEventListener("click", async () => {
    try {
      const permission = await notificationsService.enableOnThisDevice();

      if (permission === "granted") {
        context.toast.success("Notificações ativadas neste celular.");
        context.modal.close();
        await openSettingsModal(context);
        return;
      }

      if (permission === "denied") {
        context.toast.error("Permissão de notificações bloqueada.");
        context.modal.close();
        await openSettingsModal(context);
      }
    } catch (error) {
      context.toast.error(error.message || "Não foi possível ativar as notificações.");
    }
  });

  document.querySelector("#send-test-notification-button")?.addEventListener("click", async () => {
    try {
      await notificationsService.sendTestNotification();
      context.toast.success("Notificação de teste enviada.");
    } catch (error) {
      context.toast.error(error.message || "Não foi possível enviar a notificação de teste.");
    }
  });

  document.querySelector("#disable-notifications-button")?.addEventListener("click", async () => {
    notificationsService.disableOnThisDevice();
    context.toast.success("Notificações desativadas neste celular.");
    context.modal.close();
    await openSettingsModal(context);
  });
}
