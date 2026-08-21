// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

import { TAPE_PALETTE, PROFILE_KEY } from './config.js';

// Devuelve un color de la paleta basado en el nombre
export function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAPE_PALETTE[Math.abs(hash) % TAPE_PALETTE.length];
}

// Obtiene las iniciales de un nombre completo
export function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '--';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Convierte una fecha ISO a texto relativo
export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'justo ahora';
  const m = Math.floor(s / 60);
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.floor(m / 60);
  if (h < 24) return 'hace ' + h + ' h';
  return 'hace ' + Math.floor(h / 24) + ' d';
}

// Escapa texto para evitar inyección HTML
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Carga el perfil guardado en localStorage
export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Guarda el perfil en localStorage
export function saveProfile(p) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}
