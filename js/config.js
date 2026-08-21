// =====================================================
// CONFIGURACIÓN GLOBAL
// =====================================================

export const SUPABASE_URL = 'https://dasrrzlyfzoqdtlvbdbt.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_QYmfscKalC7yPA77LiwBgg_iY6FE1_P';

export const PROFILE_KEY = 'equiteam-profile';

// Guarda localmente los tableros que este navegador ha visitado/al que ha sido
// invitado, para poder mostrarlos en el grid "Mis tableros" aunque el usuario
// no tenga cuenta o no sea miembro formal en Supabase.
export const JOINED_BOARDS_KEY = 'equiteam-joined-boards';

export const COLUMN_DEFS = [
  { id: 'todo',  title: 'Por hacer',   accent: 'var(--todo)' },
  { id: 'doing', title: 'En progreso', accent: 'var(--doing)' },
  { id: 'done',  title: 'Hecho',       accent: 'var(--done)' }
];

export const TAPE_PALETTE = [
  '#d9a441', '#5b87a6', '#7fa65b', '#c0563f',
  '#8a6fb0', '#4f9d8a', '#c77b9a'
];
