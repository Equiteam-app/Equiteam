// =====================================================
// CLIENTE DE SUPABASE
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const { createClient } = window.supabase;   // la librería se carga en index.html

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
