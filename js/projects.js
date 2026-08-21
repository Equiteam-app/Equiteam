// =====================================================
// GESTIÓN DE PROYECTOS
// =====================================================

import { sb } from './supabase.js';
import { getCurrentUser } from './auth.js';

// Obtiene los proyectos donde el usuario actual es miembro
export async function fetchProjects() {
  const user = getCurrentUser();
  if (!user) return [];

  const { data, error } = await sb
    .from('project_members')
    .select('projects(*)')   // unimos con la tabla projects
    .eq('user_id', user.id);

  if (error) {
    console.error('Error al cargar proyectos:', error);
    return [];
  }
  return data.map(m => m.projects).filter(Boolean);
}

// Crea un nuevo proyecto y asigna al usuario como owner
// NOTA: solo debe llamarse si hay un usuario autenticado (ver app.js),
// ya que crear un tablero requiere cuenta.
export async function createProject(name) {
  const user = getCurrentUser();
  if (!user) return null;

  // 1. Insertar proyecto
  const { data, error } = await sb
    .from('projects')
    .insert({ name, created_by: user.id })
    .select()
    .single();

  if (error || !data) {
    console.error('Error al crear proyecto:', error);
    return null;
  }

  // 2. Insertar membresía del dueño
  await sb.from('project_members').insert({
    project_id: data.id,
    user_id: user.id,
    role: 'owner'
  });

  return data;
}

// Obtiene un proyecto por su id
export async function getProjectById(id) {
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return error ? null : data;
}

// Extrae el id de proyecto de la URL
export function getProjectIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('project');
}

// Actualiza la URL con el id del proyecto (al entrar a un tablero)
export function setProjectUrl(projectId) {
  const url = new URL(window.location);
  url.searchParams.set('project', projectId);
  window.history.pushState({}, '', url);
}

// Limpia el parámetro de proyecto en la URL (al volver al home)
export function clearProjectUrl() {
  const url = new URL(window.location);
  url.searchParams.delete('project');
  window.history.pushState({}, '', url);
}

// Genera el enlace de invitación absoluto para compartir un tablero
export function getInviteLink(projectId) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('project', projectId);
  return url.toString();
}
