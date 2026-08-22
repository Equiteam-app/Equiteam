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
// Almacenamos los datos en memoria para actualizar la UI rápidamente
let tasks = [];
let profile = loadProfile();
let currentProject = null;
let isMetricsCollapsed = true;
let realtimeChannel = null;

// Retiene el nombre de un tablero si el usuario intenta crearlo sin cuenta activa
let pendingBoardName = null;

// ==================== FUNCIONES DE RENDER (TABLERO) ====================

// Dibuja el tablero Kanban completo con base en el estado actual de la aplicación
function render() {
  renderBoard(
    tasks,
    profile,
    isMetricsCollapsed,
    () => {
      // Invertimos el estado del panel de métricas y redibujamos
      isMetricsCollapsed = !isMetricsCollapsed;
      render();
    },
    refreshTasksAndRender, // Callback vital para actualizar tras editar/eliminar
    currentProject.id
  );
}

// Sincroniza las tareas desde la base de datos y fuerza un renderizado limpio
async function refreshTasksAndRender() {
  if (currentProject) {
    tasks = await fetchTasks(currentProject.id);
    render();
  }
}

// ==================== SUSCRIPCIÓN REALTIME ====================

// Conecta con el canal de WebSockets de Supabase para escuchar cambios en vivo
function subscribeRealtime(projectId) {
  // Evitamos conexiones duplicadas cerrando el canal anterior
  if (realtimeChannel) {
    sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  // Escuchamos operaciones INSERT, UPDATE y DELETE en la tabla de tareas
  realtimeChannel = sb.channel('tasks-changes-' + projectId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      async () => {
        // Validamos que el usuario siga en el tablero antes de repintar
        if (currentProject && currentProject.id === projectId) {
          tasks = await fetchTasks(currentProject.id);
          render();
          setSyncNote('Actualizado ' + timeAgo(new Date().toISOString()));
        }
      }
    )
    .subscribe();
}

// Cierra la conexión Realtime al salir de un tablero
function unsubscribeRealtime() {
  if (realtimeChannel) {
    sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ==================== HOME (GRID DE TABLEROS) ====================

// Unifica los tableros de la base de datos con los guardados en localStorage
function mergeBoards(serverBoards, localBoards) {
  const map = new Map();
  serverBoards.forEach(p => map.set(p.id, { id: p.id, name: p.name, role: 'owner' }));
  
  // Añadimos los locales solo si no existen ya como dueños
  localBoards.forEach(b => {
    if (!map.has(b.id)) map.set(b.id, { id: b.id, name: b.name, role: 'invitado' });
  });
  return Array.from(map.values());
}

// Configura la píldora de perfil y oculta botones redundantes en la pantalla de inicio
function updateHomeProfileUI(user) {
  // Priorizamos mostrar el nombre del perfil; si no hay, usamos la primera parte del correo, o 'Invitado'
  const label = profile && profile.name ? profile.name : (user ? user.email.split('@')[0] : 'Invitado');
  updateHomeProfilePill(label, profile?.color);
  
  // Ocultamos el botón externo de iniciar sesión, ya que ahora el usuario 
  // accede al registro desde su píldora de perfil.
  const homeAuthBtn = document.getElementById('home-auth-btn');
  if (homeAuthBtn) homeAuthBtn.style.display = 'none';
}

// Prepara y dibuja la pantalla principal con la lista de proyectos
async function renderHome() {
  unsubscribeRealtime();
  currentProject = null;
  showHomeScreen();

  const user = getCurrentUser();
  updateHomeProfileUI(user);

  // Cargamos ambas fuentes de datos para unificar la lista
  const serverBoards = user ? await fetchProjects() : [];
  const localBoards = getJoinedBoards();
  const boards = mergeBoards(serverBoards, localBoards);

  // Dibuja el grid inyectando funciones de selección y borrado
  renderHomeGrid(boards, (b) => openBoard(b.id), async (b) => {
    if (!confirm(`¿Eliminar tablero "${b.name}"? Esta acción no se puede deshacer.`)) return;
    
    // Si es propietario, borra el registro permanentemente en Supabase
    if (b.role === 'owner') {
      const error = await deleteProject(b.id);
      if (error) {
        showToast('No se pudo eliminar el tablero.');
        return;
      }
    }
    
    removeJoinedBoard(b.id); // Limpia la memoria local
    await renderHome();
    showToast('Tablero eliminado');
  });
}

// ==================== ENTRAR / ABRIR UN TABLERO ====================

// Configura el contexto y carga un proyecto específico
async function enterBoard(project) {
  currentProject = project;
  addJoinedBoard(project);
  setProjectUrl(project.id);

  tasks = await fetchTasks(project.id);

  showBoardScreen();
  updateProjectHeader(project);

  // Evalúa si es necesario pedirle el nombre al usuario
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

// Resuelve el proyecto por ID antes de entrar (evita fallos por URL inválida)
async function openBoard(projectId) {
  const project = await getProjectById(projectId);
  if (!project) {
    showToast('Ese tablero ya no existe.');
    return;
  }
  await enterBoard(project);
}

// ==================== FLUJO DESPUÉS DE AUTENTICARSE ====================

// Decide a qué pantalla redirigir según el estado pendiente del usuario
async function afterAuthSuccess() {
  closeAuthModal();

  // Si intentó crear un tablero sin estar logueado, lo creamos ahora automáticamente
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

// ==================== INICIALIZACIÓN (BOOT) ====================

// Función de arranque de la aplicación SPA
async function boot() {
  // Validación estricta de credenciales de backend
  if (!SUPABASE_URL || SUPABASE_URL.includes('PEGA_AQUI') ||
      !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('PEGA_AQUI')) {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('config-warning').classList.remove('hidden');
    return;
  }

  // Restaurar estado
  await getSession();
  profile = loadProfile();

  document.getElementById('loading-screen').classList.add('hidden');

  // Enrutamiento simple: Si hay un ID en la URL, lo cargamos directo
  const projectId = getProjectIdFromUrl();
  if (projectId) {
    const project = await getProjectById(projectId);
    if (project) {
      await enterBoard(project);
      return;
    }
    // Si el ID es inválido limpiamos la URL para evitar bucles
    clearProjectUrl();
  }

  // Ruta por defecto
  await renderHome();
}

// ==================== EVENTOS GLOBALES Y MODALES ====================

// Cierra cualquier menú contextual (los de los 3 puntitos) al hacer clic en cualquier parte de la pantalla
document.addEventListener('click', () => {
  document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
});

// ----- Cierre universal de modales -----
// Permite al usuario salir de cualquier modal haciendo clic en el fondo oscuro
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    // Verifica que el clic sea exactamente en el fondo oscuro y no dentro de la caja blanca
    if (e.target === overlay) {
      overlay.classList.add('hidden');
    }
  });
});

// Cierra los modales usando los respectivos botones de equis (X) superior
document.getElementById('auth-close').addEventListener('click', closeAuthModal);
document.getElementById('signup-close').addEventListener('click', closeSignupModal);
document.getElementById('profile-close').addEventListener('click', closeProfileModal);

// ----- Gestión del Perfil (Apertura) -----
// Abre el menú de perfil estando dentro de un tablero de trabajo
document.getElementById('profile-pill').addEventListener('click', () => {
  openProfileModal(profile, getCurrentUser());
});

// Abre el menú de perfil desde la pantalla de inicio ("Mis tableros")
document.getElementById('home-profile-pill').addEventListener('click', () => {
  openProfileModal(profile, getCurrentUser());
});

// ----- Gestión del Perfil (Validación y Guardado) -----
// Deshabilita el botón de guardar si el usuario borra su nombre (evita perfiles vacíos)
document.getElementById('profile-input').addEventListener('input', (e) => {
  document.getElementById('profile-save').disabled = !e.target.value.trim();
});

// Atajo de teclado: permite guardar el perfil presionando la tecla "Enter"
document.getElementById('profile-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    document.getElementById('profile-save').click();
  }
});

// Recupera los datos ingresados, los guarda localmente y actualiza la vista visual
document.getElementById('profile-save').addEventListener('click', () => {
  const name = document.getElementById('profile-input').value.trim();
  if (!name) return;

  // Recupera el color seleccionado desde los datos temporales del modal
  const overlay = document.getElementById('profile-modal');
  const selectedColor = overlay.dataset.selectedColor || '#d9a441';

  // Actualiza la variable en memoria y persiste la información
  profile = { name, color: selectedColor };
  saveProfile(profile);
  closeProfileModal();

  // Redibuja la interfaz correcta dependiendo de si estamos en un proyecto o en el home
  if (currentProject) {
    applyProfilePill(profile, getCurrentUser());
    render();
  } else {
    renderHome();
  }
});

// ----- Cierre de sesión (Centralizado) -----
// Desconecta la cuenta en Supabase, limpia la URL y recarga la página para estado en cero
const profileLogoutBtn = document.getElementById('profile-logout-btn');
if (profileLogoutBtn) {
  profileLogoutBtn.addEventListener('click', async () => {
    await signOut();
    clearProjectUrl(); // Evita que al recargar intentemos volver a entrar al tablero automáticamente
    location.reload(); // Recarga toda la aplicación web
  });
}

// ==================== AUTENTICACIÓN (DOM EVENTS) ====================

const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authLoginBtn = document.getElementById('auth-login-btn');
const authMessage = document.getElementById('auth-message');

const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupConfirmPassword = document.getElementById('signup-confirm-password');
const signupBtn = document.getElementById('signup-btn');
const signupMessage = document.getElementById('signup-message');

// Valida campos vacíos para el login
function updateLoginButton() {
  const emailOk = authEmail.value.trim().length > 0;
  const passwordOk = authPassword.value.length >= 6;
  authLoginBtn.disabled = !(emailOk && passwordOk);
}

authEmail.addEventListener('input', updateLoginButton);
authPassword.addEventListener('input', updateLoginButton);

// Valida campos vacíos para el registro
function updateSignupButton() {
  const emailOk = signupEmail.value.trim().length > 0;
  const passwordOk = signupPassword.value.length >= 6;
  const confirmOk = signupConfirmPassword.value.length > 0;
  signupBtn.disabled = !(emailOk && passwordOk && confirmOk);
}

signupEmail.addEventListener('input', updateSignupButton);
signupPassword.addEventListener('input', updateSignupButton);
signupConfirmPassword.addEventListener('input', updateSignupButton);

// Transiciones de vistas (Login <-> Sign Up)
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

// Solicitud de Login a Supabase
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

// Solicitud de Registro a Supabase
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

// ==================== OPERACIONES DE TABLEROS ====================

document.getElementById('open-create-project-btn').addEventListener('click', openProjectModal);
document.getElementById('create-project-cancel').addEventListener('click', closeProjectModal);

document.getElementById('new-project-name').addEventListener('input', (e) => {
  document.getElementById('create-project-btn').disabled = !e.target.value.trim();
});

document.getElementById('new-project-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    document.getElementById('create-project-btn').click();
  }
});

// Creación de tablero con barrera de autenticación
document.getElementById('create-project-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-project-name').value.trim();
  if (!name) return;

  const user = getCurrentUser();
  if (!user) {
    pendingBoardName = name; // Guardamos el nombre propuesto en memoria temporal
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

// Salida al Hub de Proyectos
document.getElementById('back-to-home-btn').addEventListener('click', () => {
  unsubscribeRealtime();
  clearProjectUrl();
  renderHome();
});

// Compartir usando el ID seguro y nativo de Clipboard API
document.getElementById('share-btn').addEventListener('click', async () => {
  if (!currentProject) return;
  
  // CORRECCIÓN: Se requiere usar solo el ID del proyecto para formatear la URL limpia
  const link = getInviteLink(currentProject.id); 
  
  try {
    await navigator.clipboard.writeText(link);
    showToast('Enlace de invitación copiado ✅');
  } catch (e) {
    showToast(link); // Fallback amigable si el navegador bloquea el portapapeles
  }
});

// ==================== OPERACIONES DE TAREAS ====================

document.getElementById('add-task-cancel').addEventListener('click', closeAddTaskModal);

// Inserción de nueva tarea y repintado visual preventivo
document.getElementById('add-task-save').addEventListener('click', async () => {
  const text = document.getElementById('new-task-text').value.trim();
  if (!text) return;
  const dueDate = document.getElementById('new-task-date').value;
  
  await addTask(currentProject.id, 'todo', text, dueDate);
  closeAddTaskModal();
  
  // Forzamos actualización local por si la red/realtime sufre retrasos
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

// ==================== LISTENERS EXTERNOS ====================

// Monitor de eventos de sesión integrados
onAuthChange((event) => {
  // Solo forzamos recarga total si se cierra sesión para purgar la memoria caché
  if (event === 'SIGNED_OUT') {
    location.reload();
  }
});

// Ejecución inicial 
boot();
