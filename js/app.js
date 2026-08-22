// =====================================================
// APLICACIÓN PRINCIPAL (ORQUESTADOR)
// =====================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { sb } from './supabase.js';
import {
  loadProfile, saveProfile, timeAgo, colorForName, initials,
  getJoinedBoards, addJoinedBoard, removeJoinedBoard
} from './utils.js';
import {
  getSession, onAuthChange, signInWithPassword, signUpWithPassword, signOut, getCurrentUser
} from './auth.js';
import {
  fetchProjects, createProject, deleteProject, getProjectById,
  getProjectIdFromUrl, setProjectUrl, clearProjectUrl, getInviteLink
} from './projects.js';
import { fetchTasks, addTask } from './tasks.js';
import {
  renderBoard, updateProjectHeader, setSyncNote, applyProfilePill,
  openProfileModal, closeProfileModal, openAddTaskModal, closeAddTaskModal,
  openProjectModal, closeProjectModal, setAuthMessage, openAuthModal, closeAuthModal, 
  openSignupModal, closeSignupModal, showHomeScreen, showBoardScreen, renderHomeGrid, 
  updateHomeProfilePill, setHomeAuthButton, showToast
} from './ui.js';

// ==================== ESTADO GLOBAL ====================
let tasks = [];
let profile = loadProfile();
let currentProject = null;
let isMetricsCollapsed = true;
let realtimeChannel = null;
// Nombre pendiente de un tablero que el usuario quiso crear sin tener cuenta;
// se retoma automáticamente después de iniciar sesión o registrarse.
let pendingBoardName = null;

// ==================== FUNCIÓN PRINCIPAL DE RENDER (TABLERO) ====================
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
    realtimeChannel = null;
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

function unsubscribeRealtime() {
  if (realtimeChannel) {
    sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ==================== HOME (GRID DE TABLEROS) ====================

// Combina los tableros del servidor (donde el usuario es miembro registrado)
// con los tableros recordados localmente (creados o abiertos por invitación
// en este navegador), sin duplicar.
function mergeBoards(serverBoards, localBoards) {
  const map = new Map();
  serverBoards.forEach(p => map.set(p.id, { id: p.id, name: p.name, role: 'owner' }));
  localBoards.forEach(b => {
    if (!map.has(b.id)) map.set(b.id, { id: b.id, name: b.name, role: 'invitado' });
  });
  return Array.from(map.values());
}

function updateHomeProfileUI(user) {
  if (user) {
    updateHomeProfilePill(user.email);
    setHomeAuthButton('Cerrar sesión', async () => {
      await signOut();
      clearProjectUrl();
      await renderHome();
    });
  } else {
    const label = profile && profile.name ? profile.name : 'Invitado';
    updateHomeProfilePill(label);
    setHomeAuthButton('Iniciar sesión', () => {
      setAuthMessage('');
      openAuthModal();
    });
  }
}

async function renderHome() {
  unsubscribeRealtime();
  currentProject = null;
  showHomeScreen();

  const user = getCurrentUser();
  updateHomeProfileUI(user);

  const serverBoards = user ? await fetchProjects() : [];
  const localBoards = getJoinedBoards();
  const boards = mergeBoards(serverBoards, localBoards);

  // Boton de eliminar tablero
  renderHomeGrid(boards, (b) => openBoard(b.id), async (b) => {
  if (!confirm(`¿Eliminar tablero "${b.name}"? Esta acción no se puede deshacer.`)) return;
  
  if (b.role === 'owner') {
    const error = await deleteProject(b.id);
    if (error) {
      showToast('No se pudo eliminar el tablero.');
      return;
    }
  }
  
  removeJoinedBoard(b.id);
  await renderHome();
  showToast('Tablero eliminado');
});
}

// ==================== ENTRAR / ABRIR UN TABLERO ====================
async function enterBoard(project) {
  currentProject = project;
  addJoinedBoard(project);
  setProjectUrl(project.id);

  tasks = await fetchTasks(project.id);

  showBoardScreen();
  updateProjectHeader(project);

  // El botón de "Cerrar sesión" solo tiene sentido si hay una cuenta activa
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.style.display = getCurrentUser() ? 'inline-block' : 'none';

  profile = loadProfile();
  if (profile && profile.name) {
    applyProfilePill(profile, getCurrentUser());
  } else {
    openProfileModal(profile, getCurrentUser());
  }

  render();
  setSyncNote('Actualizado ' + timeAgo(new Date().toISOString()));
  subscribeRealtime(project.id);
}

async function openBoard(projectId) {
  const project = await getProjectById(projectId);
  if (!project) {
    showToast('Ese tablero ya no existe.');
    return;
  }
  await enterBoard(project);
}

// ==================== FLUJO DESPUÉS DE AUTENTICARSE ====================
async function afterAuthSuccess() {
  closeAuthModal();

  // Si el usuario quería crear un tablero pero no tenía cuenta, lo creamos ahora
  if (pendingBoardName) {
    const name = pendingBoardName;
    pendingBoardName = null;
    const project = await createProject(name);
    if (project) {
      await enterBoard(project);
      return;
    }
  }

  if (currentProject) {
    await enterBoard(currentProject);
  } else {
    await renderHome();
  }
}

// ==================== INICIALIZACIÓN ====================
async function boot() {
  // 1. Verificar credenciales de Supabase
  if (!SUPABASE_URL || SUPABASE_URL.includes('PEGA_AQUI') ||
      !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('PEGA_AQUI')) {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('config-warning').classList.remove('hidden');
    return;
  }

  // 2. Cargar la sesión si existe (no es obligatoria para navegar)
  await getSession();
  profile = loadProfile();

  document.getElementById('loading-screen').classList.add('hidden');

  // 3. Si la URL trae un id de proyecto (enlace de invitación o recarga
  //    dentro de un tablero), entramos directo — sin exigir cuenta.
  const projectId = getProjectIdFromUrl();
  if (projectId) {
    const project = await getProjectById(projectId);
    if (project) {
      await enterBoard(project);
      return;
    }
    // El id en la URL ya no es válido: volvemos al home
    clearProjectUrl();
  }

  // 4. Sin proyecto en la URL: mostramos el home con el grid de tableros
  await renderHome();
}

// ==================== EVENTOS DE MODALES Y BOTONES ====================
document.addEventListener('click', () => {
  document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
});

// ---------- Cerrar modales con la × ----------
document.getElementById('auth-close').addEventListener('click', () => {
  closeAuthModal();
});

document.getElementById('signup-close').addEventListener('click', () => {
  closeSignupModal();
});

// ---------- Perfil (nombre, sin cuenta) ----------
document.getElementById('profile-pill').addEventListener('click', () => {
  openProfileModal(profile, getCurrentUser());
});

document.getElementById('home-profile-pill').addEventListener('click', () => {
  openProfileModal(profile, getCurrentUser());
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

  // Obtener color seleccionado del modal
  const overlay = document.getElementById('profile-modal');
  const selectedColor = overlay.dataset.selectedColor || '#d9a441';

  profile = { name, color: selectedColor };
  saveProfile(profile);
  closeProfileModal();

  if (currentProject) {
    applyProfilePill(profile, getCurrentUser());
    render();
  } else {
    renderHome();
  }
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
  closeAuthModal();
  openSignupModal();
});

document.getElementById('show-login-link').addEventListener('click', (e) => {
  e.preventDefault();
  closeSignupModal();
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
    await afterAuthSuccess();
  }
});

// --- Signup ---
signupBtn.addEventListener('click', async () => {
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const confirmPassword = signupConfirmPassword.value;

  if (password !== confirmPassword) {
    signupMessage.textContent = 'Las contraseñas no coinciden.';
    signupConfirmPassword.value = '';
    signupConfirmPassword.focus();
    return;
  }

  signupMessage.textContent = 'Creando cuenta…';
  const result = await signUpWithPassword(email, password);

  if (result) {
    signupMessage.textContent = result.message ? result.message : 'Error: ' + result.message;
  } else {
    signupMessage.textContent = '';
    closeSignupModal();
    await afterAuthSuccess();
  }
});

// --- Enter en login / signup ---
authPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!authLoginBtn.disabled) authLoginBtn.click();
  }
});

signupConfirmPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!signupBtn.disabled) signupBtn.click();
  }
});

// ==================== CIERRE DE SESIÓN ====================
document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  clearProjectUrl();
  location.reload();
});

// ==================== HOME: NAVEGACIÓN Y CREACIÓN DE TABLEROS ====================

// Botón "+ Nuevo tablero" (abre el popup de creación)
document.getElementById('open-create-project-btn').addEventListener('click', () => {
  openProjectModal();
});

document.getElementById('create-project-cancel').addEventListener('click', () => {
  closeProjectModal();
});

document.getElementById('new-project-name').addEventListener('input', (e) => {
  document.getElementById('create-project-btn').disabled = !e.target.value.trim();
});

document.getElementById('new-project-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    document.getElementById('create-project-btn').click();
  }
});

// Crear tablero: requiere cuenta. Si no hay sesión, se guarda el nombre
// pendiente y se pide iniciar sesión / registrarse.
document.getElementById('create-project-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-project-name').value.trim();
  if (!name) return;

  const user = getCurrentUser();
  if (!user) {
    pendingBoardName = name;
    closeProjectModal();
    setAuthMessage('Para crear un tablero nuevo necesitas iniciar sesión o crear una cuenta. Tus compañeros pueden unirse solo con su nombre usando el enlace de invitación, sin necesidad de cuenta.');
    openAuthModal();
    return;
  }

  const project = await createProject(name);
  closeProjectModal();
  if (project) {
    await enterBoard(project);
  } else {
    showToast('No se pudo crear el tablero. Intenta de nuevo.');
  }
});

// Volver del tablero al home
document.getElementById('back-to-home-btn').addEventListener('click', () => {
  unsubscribeRealtime();
  clearProjectUrl();
  renderHome();
});

// Compartir / invitar: copia el enlace del tablero actual
document.getElementById('share-btn').addEventListener('click', async () => {
  if (!currentProject) return;
  const link = getInviteLink(currentProject);
  try {
    await navigator.clipboard.writeText(link);
    showToast('Enlace de invitación copiado ✅');
  } catch (e) {
    showToast(link);
  }
});

// ==================== NUEVA TAREA ====================
document.getElementById('add-task-cancel').addEventListener('click', closeAddTaskModal);

//Refresca las tareas en vivo
document.getElementById('add-task-save').addEventListener('click', async () => {
  const text = document.getElementById('new-task-text').value.trim();
  if (!text) return;
  const dueDate = document.getElementById('new-task-date').value;
  await addTask(currentProject.id, 'todo', text, dueDate);
  closeAddTaskModal();
  // Forzar refresh inmediato (fallback si Realtime tiene delay)
  tasks = await fetchTasks(currentProject.id);
  render();
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
onAuthChange((event) => {
  if (event === 'SIGNED_OUT') {
    location.reload();
  }
  // SIGNED_IN se maneja explícitamente en los botones de login/signup
  // (afterAuthSuccess) para controlar el flujo de "tablero pendiente".
});

// ==================== ARRANQUE ====================
boot();
