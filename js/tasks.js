// =====================================================
// GESTIÓN DE TAREAS
// =====================================================

import { sb } from './supabase.js';

// Obtiene todas las tareas de un proyecto
export async function fetchTasks(projectId) {
  if (!projectId) return [];
  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error al cargar tareas:', error);
    return [];
  }
  return data;
}

// Agrega una tarea a la columna 'todo'
export async function addTask(projectId, columnId, text, dueDate) {
  const payload = {
    text,
    column_id: columnId,
    author: null,
    project_id: projectId
  };
  if (dueDate) payload.due_date = dueDate;
  const { error } = await sb.from('tasks').insert(payload);
  return error;
}

// Mueve una tarea a otra columna
export async function moveTask(taskId, columnId, authorName, projectId) {
  const updates = {
    column_id: columnId,
    author: columnId === 'todo' ? null : authorName
  };
  const { error } = await sb
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('project_id', projectId);
  return error;
}

// Elimina una tarea
export async function deleteTask(taskId, projectId) {
  const { error } = await sb
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('project_id', projectId);
  return error;
}

// Actualiza el texto y/o fecha de una tarea
export async function updateTaskData(taskId, text, dueDate, projectId) {
  const payload = { text };
  if (dueDate !== undefined) payload.due_date = dueDate || null;
  const { error } = await sb
    .from('tasks')
    .update(payload)
    .eq('id', taskId)
    .eq('project_id', projectId);
  return error;
}
