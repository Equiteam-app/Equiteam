// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

import { TAPE_PALETTE, PROFILE_KEY, JOINED_BOARDS_KEY } from './config.js';

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
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const s = Math.abs(diff);

  if (s < 60) return diff >= 0 ? 'justo ahora' : 'en un momento';
  const m = Math.floor(s / 60);
  if (m < 60) return (diff >= 0 ? 'hace ' : 'en ') + m + ' min';
  const h = Math.floor(m / 60);
  if (h < 24) return (diff >= 0 ? 'hace ' : 'en ') + h + ' h';
  return (diff >= 0 ? 'hace ' : 'en ') + Math.floor(h / 24) + ' d';
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

// =====================================================
// TABLEROS VISITADOS / INVITADOS (localStorage)
// =====================================================
// Como los usuarios que ingresan solo con su nombre no tienen una cuenta
// de Supabase, no podemos guardar su membresía en la base de datos.
// En su lugar, recordamos en este navegador los tableros a los que ha
// entrado (creados o por invitación), para mostrarlos en el grid "Mis tableros".

// Obtiene la lista de tableros recordados en este navegador
export function getJoinedBoards() {
  try {
    const raw = localStorage.getItem(JOINED_BOARDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Agrega (o actualiza) un tablero en la lista local de recordados
export function addJoinedBoard(project) {
  if (!project || !project.id) return;
  const boards = getJoinedBoards().filter(b => b.id !== project.id);
  boards.unshift({
    id: project.id,
    name: project.name,
    joinedAt: new Date().toISOString()
  });
  // Limitamos el historial para no acumular indefinidamente
  localStorage.setItem(JOINED_BOARDS_KEY, JSON.stringify(boards.slice(0, 40)));
}

// Elimina un tablero de la lista local recordada (por ejemplo, si ya no existe)
export function removeJoinedBoard(projectId) {
  const boards = getJoinedBoards().filter(b => b.id !== projectId);
  localStorage.setItem(JOINED_BOARDS_KEY, JSON.stringify(boards));
}
