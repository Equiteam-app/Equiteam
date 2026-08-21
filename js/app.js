// =====================================================
// APLICACIÓN PRINCIPAL (ORQUESTADOR)
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { loadProfile, saveProfile, timeAgo } from './utils.js';  // <-- AÑADIDO timeAgo
import {
  getSession, onAuthChange, signInWithPassword, signUpWithPassword, signOut, getCurrentUser
} from './auth.js';  // <-- ACTUALIZADO: ahora usa signInWithPassword y signUpWithPassword
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
    render,           // callback para refrescar (por ejemplo, al cancelar edición)
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

// ==================== AUTENTICACIÓN (EMAIL + PASSWORD) ====================

// --- Referencias login ---
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authLoginBtn = document.getElementById('auth-login-btn');
const authMessage = document.getElementById('auth-message');

// --- Referencias signup ---
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupConfirmPassword = document.getElementById('signup-confirm-password');
const signupBtn = document.getElementById('signup-btn');
const signupMessage = document.getElementById('signup-message');

// --- Referencias modales ---
const authModal = document.getElementById('auth-modal');
const signupModal = document.getElementById('signup-modal');

// --- Función para abrir/cerrar modales de autenticación ---
function openAuthModal() {
  authModal.classList.remove('hidden');
  signupModal.classList.add('hidden');
  setTimeout(() => authEmail.focus(), 50);
}

function openSignupModal() {
  signupModal.classList.remove('hidden');
  authModal.classList.add('hidden');
  setTimeout(() => signupEmail.focus(), 50);
}

function closeAuthModal() {
  authModal.classList.add('hidden');
}

function closeSignupModal() {
  signupModal.classList.add('hidden');
}

// Exportar estas funciones si se usan en otros archivos (no es necesario aquí)

// --- Habilitar/deshabilitar botón de login ---
function updateLoginButton() {
  const emailOk = authEmail.value.trim().length > 0;
  const passwordOk = authPassword.value.length >= 6;
  authLoginBtn.disabled = !(emailOk && passwordOk);
}

authEmail.addEventListener('input', updateLoginButton);
authPassword.addEventListener('input', updateLoginButton);

// --- Habilitar/deshabilitar botón de signup ---
function updateSignupButton() {
  const emailOk = signupEmail.value.trim().length > 0;
  const passwordOk = signupPassword.value.length >= 6;
  const confirmOk = signupConfirmPassword.value.length > 0;
  signupBtn.disabled = !(emailOk && passwordOk && confirmOk);
}

signupEmail.addEventListener('input', updateSignupButton);
signupPassword.addEventListener('input', updateSignupButton);
signupConfirmPassword.addEventListener('input', updateSignupButton);

// --- Enlaces para cambiar entre modales ---
document.getElementById('show-signup-link').addEventListener('click', (e) => {
  e.preventDefault();
  openSignupModal();
});

document.getElementById('show-login-link').addEventListener('click', (e) => {
  e.preventDefault();
  openAuthModal();
});

// --- Login ---
authLoginBtn.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) return;

  authMessage.textContent = 'Iniciando sesión…';
  const error = await signInWithPassword(email, password);

  if (error) {
    authMessage.textContent = 'Error: ' + error.message;
  } else {
    authMessage.textContent = '';
    closeAuthModal();
    boot(); // recargar la app con la sesión iniciada
  }
});

// --- Signup ---
signupBtn.addEventListener('click', async () => {
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const confirmPassword = signupConfirmPassword.value;

  // Validar que las contraseñas coincidan
  if (password !== confirmPassword) {
    signupMessage.textContent = 'Las contraseñas no coinciden.';
    signupConfirmPassword.value = '';
    signupConfirmPassword.focus();
    return;
  }

  signupMessage.textContent = 'Creando cuenta…';
  const result = await signUpWithPassword(email, password);

  if (result) {
    if (result.message) {
      signupMessage.textContent = result.message;
    } else {
      signupMessage.textContent = 'Error: ' + result.message;
    }
  } else {
    signupMessage.textContent = '';
    closeSignupModal();
    boot();
  }
});

// --- Enter en login ---
authPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!authLoginBtn.disabled) authLoginBtn.click();
  }
});

// --- Enter en signup ---
signupConfirmPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!signupBtn.disabled) signupBtn.click();
  }
});

// ==================== CIERRE DE SESIÓN ====================
document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  location.reload();
});

// ==================== PROYECTOS ====================
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

// ==================== NUEVA TAREA ====================
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

// ==================== CAMBIOS DE AUTENTICACIÓN ====================
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
