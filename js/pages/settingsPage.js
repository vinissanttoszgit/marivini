import authService from "../services/authService.js";
import { button } from "../components/button.js";

export async function openSettingsModal(context) {
  const user = await authService.getUser();

  context.modal.open({
    title: "Configurações",
    description: "Perfil, sessão e próximos ajustes do app.",
    content: `
      <div class="form-stack">
        <div class="card" style="padding: 16px;">
          <p class="eyebrow">Conta</p>
          <h3 style="margin-top: 8px;">${user?.email ?? "Usuário"}</h3>
          <p style="margin-top: 6px;">Login ativo com Supabase Auth.</p>
        </div>
        <div class="card" style="padding: 16px;">
          <p class="eyebrow">Tema</p>
          <p style="margin-top: 8px;">As cores globais ficam em <strong>/css/variables.css</strong>.</p>
        </div>
      </div>
    `,
    footer: `
      ${button("Fechar", "ghost", 'type="button" data-close-modal')}
      ${button("Sair da conta", "danger", 'type="button" id="logout-button"')}
    `
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
