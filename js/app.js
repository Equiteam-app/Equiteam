// =====================================================
// APLICACIÓN PRINCIPAL (ORQUESTADOR)
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { loadProfile, saveProfile } from './utils.js';
import {
  getSession, onAuthChange, signInWithMagicLink, signOut, getCurrentUser
} from './auth.js';
import {
  fetchProjects, createProject, getProjectById,
  getProjectIdFromUrl, setProjectUrl
} from './projects.js';
import { fetchTasks, addTask } from './tasks.js';
import {
  renderBoard, updateProjectHeader, setSyncNote, applyProfilePill,
  openProfileModal, closeProfileModal, openAddTaskModal, closeAddTaskModal,
  openProjectModal, closeProjectModal, openAuthModal, closeAuthModal,
  setAuthMessage, renderProjectList
} from './ui.js';

// ==================== ESTADO GLOBAL ====================
let tasks = [];
let profile = loadProfile();
let currentProject = null;
let isMetricsCollapsed = true;
let realtimeChannel = null;

// ==================== FUNCIÓN PRINCIPAL DE RENDER ====================
function render() {
  renderBoard(
    tasks,
    profile,
    isMetricsCollapsed,
    () => {
      isMetricsCollapsed = !isMetricsCollapsed;
      render();
    },
    render,           // callback para refrescar (por ejemplo, en cancelar edición)
    currentProject.id
  );
}

// ==================== SUSCRIPCIÓN REALTIME ====================
function subscribeRealtime(projectId) {
  if (realtimeChannel) {
    sb.removeChannel(realtimeChannel);
  }

  realtimeChannel = sb.channel('tasks-changes-' + projectId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${projectId}`
      },
      async () => {
        tasks = await fetchTasks(currentProject.id);
        render();
        setSyncNote('Actualizado ' + timeAgo(new Date().toISOString()));
      }
    )
    .subscribe();
}

// ==================== MANEJO DE PROYECTOS ====================
async function selectProject(project) {
  currentProject = project;
  setProjectUrl(project.id);
  closeProjectModal();

  tasks = await fetchTasks(currentProject.id);

  document.getElementById('app').style.display = 'block';
  updateProjectHeader(project);

  if (profile && profile.name) {
    applyProfilePill(profile);
  } else {
    openProfileModal('');
  }

  render();
  setSyncNote('Actualizado ' + timeAgo(new Date().toISOString()));
  subscribeRealtime(currentProject.id);
}

// ==================== INICIALIZACIÓN ====================
async function boot() {
  // 1. Verificar credenciales
  if (!SUPABASE_URL || SUPABASE_URL.includes('PEGA_AQUI') ||
      !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('PEGA_AQUI')) {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('config-warning').classList.remove('hidden');
    return;
  }

  // 2. Obtener sesión
  const user = await getSession();
  if (!user) {
    document.getElementById('loading-screen').classList.add('hidden');
    openAuthModal();
    return;
  }

  // 3. Cargar perfil local
  profile = loadProfile();

  // 4. Obtener proyecto de la URL
  const projectId = getProjectIdFromUrl();
  if (projectId) {
    currentProject = await getProjectById(projectId);
  }

  // 5. Ocultar pantalla de carga
  document.getElementById('loading-screen').classList.add('hidden');

  // 6. Si no hay proyecto, mostrar selector
  if (!currentProject) {
    document.getElementById('app').style.display = 'none';
    const projects = await fetchProjects();
    renderProjectList(projects, selectProject);
    openProjectModal();
    return;
  }

  // 7. Cargar tareas y mostrar tablero
  tasks = await fetchTasks(currentProject.id);
  document.getElementById('app').style.display = 'block';
  updateProjectHeader(currentProject);

  if (profile && profile.name) {
    applyProfilePill(profile);
  } else {
    openProfileModal('');
  }

  render();
  setSyncNote('Actualizado ' + timeAgo(new Date().toISOString()));
  subscribeRealtime(currentProject.id);
}

// ==================== EVENTOS DE MODALES Y BOTONES ====================
document.addEventListener('click', () => {
  document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
});

// Perfil
document.getElementById('profile-pill').addEventListener('click', () => {
  openProfileModal(profile ? profile.name : '');
});

document.getElementById('profile-input').addEventListener('input', (e) => {
  document.getElementById('profile-save').disabled = !e.target.value.trim();
});

document.getElementById('profile-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    document.getElementById('profile-save').click();
  }
});

document.getElementById('profile-save').addEventListener('click', () => {
  const name = document.getElementById('profile-input').value.trim();
  if (!name) return;
  profile = { name };
  saveProfile(profile);
  applyProfilePill(profile);
  closeProfileModal();
  render();
});

// Autenticación
document.getElementById('auth-email').addEventListener('input', (e) => {
  document.getElementById('auth-send-link').disabled = !e.target.value.trim();
});

document.getElementById('auth-email').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    document.getElementById('auth-send-link').click();
  }
});

document.getElementById('auth-send-link').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) return;
  setAuthMessage('Enviando enlace…');
  const error = await signInWithMagicLink(email);
  if (error) {
    setAuthMessage('Error: ' + error.message);
  } else {
    setAuthMessage('Revisa tu correo y haz clic en el enlace para entrar.');
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  location.reload();
});

// Proyectos (modal)
document.getElementById('new-project-name').addEventListener('input', (e) => {
  document.getElementById('create-project-btn').disabled = !e.target.value.trim();
});

document.getElementById('new-project-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    document.getElementById('create-project-btn').click();
  }
});

document.getElementById('create-project-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-project-name').value.trim();
  if (!name) return;
  const project = await createProject(name);
  if (project) selectProject(project);
});

// Nueva tarea
document.getElementById('add-task-cancel').addEventListener('click', closeAddTaskModal);

document.getElementById('add-task-save').addEventListener('click', async () => {
  const text = document.getElementById('new-task-text').value.trim();
  if (!text) return;
  const dueDate = document.getElementById('new-task-date').value;
  await addTask(currentProject.id, 'todo', text, dueDate);
  closeAddTaskModal();
});

document.getElementById('new-task-text').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('add-task-save').click();
  }
  if (e.key === 'Escape') {
    closeAddTaskModal();
  }
});

// Cambios de autenticación (por ejemplo, al volver del enlace mágico)
onAuthChange((event, session) => {
  if (event === 'SIGNED_IN') {
    closeAuthModal();
    boot();
  } else if (event === 'SIGNED_OUT') {
    location.reload();
  }
});

// ==================== ARRANQUE ====================
boot();
