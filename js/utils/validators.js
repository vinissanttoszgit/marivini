export function validateEmail(value) {
  if (!value) {
    return "Informe seu e-mail.";
  }

  const valid = /\S+@\S+\.\S+/.test(value);
  return valid ? "" : "Digite um e-mail válido.";
}

export function validatePassword(value) {
  if (!value) {
    return "Informe sua senha.";
  }

  return value.length >= 6 ? "" : "A senha precisa ter no mínimo 6 caracteres.";
}

export function validateRequired(value, message) {
  return value ? "" : message;
}
