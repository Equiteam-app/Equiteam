// =====================================================
// AUTENTICACIÓN CON SUPABASE
// =====================================================

import { sb } from './supabase.js';

let currentUser = null;   // usuario autenticado

export function setCurrentUser(user) {
  currentUser = user;
}

export function getCurrentUser() {
  return currentUser;
}

// Obtiene la sesión actual y actualiza currentUser
export async function getSession() {
  const { data } = await sb.auth.getSession();
  currentUser = data?.session?.user || null;
  return currentUser;
}

// Envía un enlace mágico al correo
export async function signInWithMagicLink(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
  return error;
}

// Cierra la sesión
export async function signOut() {
  await sb.auth.signOut();
  currentUser = null;
}

// Suscripción a cambios de sesión (login/logout)
export function onAuthChange(callback) {
  sb.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    callback(event, session);
  });
}
