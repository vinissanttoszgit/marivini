import { isSupabaseConfigured, supabase } from "../config/supabase.js";

function ensureClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Configure o Supabase em /js/config/supabase.js para usar autenticação.");
  }
}

async function getSession() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  return data.session;
}

async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

async function signIn({ email, password }) {
  ensureClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  return data;
}

async function signUp({ email, password }) {
  ensureClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw error;
  }
  return data;
}

async function signOut() {
  ensureClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

function onAuthStateChange(callback) {
  if (!supabase) {
    return () => {};
  }

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session));

  return () => subscription.unsubscribe();
}

export async function getCurrentUserId() {
  const user = await getUser();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }
  return user.id;
}

export default {
  getSession,
  getUser,
  signIn,
  signUp,
  signOut,
  onAuthStateChange
};
