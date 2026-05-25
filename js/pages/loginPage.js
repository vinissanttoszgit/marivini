import { isSupabaseConfigured } from "../config/supabase.js";
import { initializeTheme } from "../config/theme.js";
import authService from "../services/authService.js";
import { Toast } from "../components/toast.js";
import { button } from "../components/button.js";
import { validateEmail, validatePassword } from "../utils/validators.js";

const root = document.querySelector("#login-root");
const toast = new Toast();

let mode = "login";

init();

async function init() {
  initializeTheme();

  const session = await authService.getSession();
  if (session) {
    window.location.replace("./index.html");
    return;
  }

  render();
}

function render() {
  root.innerHTML = `
    <section class="auth-brand">
      <div class="auth-brand__badge">🌿 Marivini</div>
      <h1 class="auth-brand__title">${mode === "login" ? "Entre na sua rotina" : "Crie sua conta"}</h1>
      <p class="auth-brand__subtitle">Um organizador pessoal mobile-first para hábitos, calendário e lembretes.</p>
    </section>

    ${!isSupabaseConfigured ? `<div class="auth-note">Preencha a URL e a ANON KEY em <strong>/js/config/supabase.js</strong> antes de usar login real.</div>` : ""}

    <form class="form-stack" id="auth-form" style="margin-top: 18px;">
      <label>
        E-mail
        <input type="email" name="email" placeholder="voce@email.com" required />
      </label>
      <label>
        Senha
        <input type="password" name="password" placeholder="Mínimo de 6 caracteres" required />
      </label>
      ${button(mode === "login" ? "Entrar" : "Criar conta", "primary", 'type="submit"')}
    </form>

    <p class="auth-toggle">
      ${mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}
      <button class="subtle-link" id="toggle-auth">${mode === "login" ? "Criar agora" : "Entrar"}</button>
    </p>
  `;

  root.querySelector("#toggle-auth").addEventListener("click", () => {
    mode = mode === "login" ? "signup" : "login";
    render();
  });

  root.querySelector("#auth-form").addEventListener("submit", handleSubmit);
}

async function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email")).trim();
  const password = String(formData.get("password")).trim();

  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);

  if (emailError || passwordError) {
    toast.error(emailError || passwordError);
    return;
  }

  try {
    if (mode === "login") {
      await authService.signIn({ email, password });
      window.location.replace("./index.html");
      return;
    }

    await authService.signUp({ email, password });
    toast.success("Conta criada. Faça login para continuar.");
    mode = "login";
    render();
  } catch (error) {
    toast.error(error.message || "Não foi possível autenticar.");
  }
}
