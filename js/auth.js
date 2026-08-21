// =====================================================
// AUTENTICACIÓN CON SUPABASE (EMAIL + PASSWORD)
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

// Inicia sesión con email y contraseña
export async function signInWithPassword(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) return error;
  currentUser = data.user;
  return null; // sin error
}

// Crea una cuenta nueva (y queda con sesión iniciada si la confirmación está desactivada)
export async function signUpWithPassword(email, password) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.href
    }
  });

  if (error) return error;

  // Si la confirmación de correo está desactivada, la sesión ya está activa
  if (data.session) {
    currentUser = data.session.user;
  } else {
    // Si se requiere confirmar correo, mostramos mensaje
    return { message: 'Te hemos enviado un correo de confirmación. Revisa tu bandeja de entrada.' };
  }

  return null;
}

// Cierra la sesión
export async function signOut() {
  await sb.auth.signOut();
  currentUser = null;
}

// Suscripción a cambios de sesión
export function onAuthChange(callback) {
  sb.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    callback(event, session);
  });
}
