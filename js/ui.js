// =====================================================
// INTERFAZ DE USUARIO (RENDERIZADO Y MODALES)
// =====================================================

import { COLUMN_DEFS, TAPE_PALETTE } from './config.js';
import { colorForName, initials, timeAgo, escapeHtml } from './utils.js';
import { moveTask, deleteTask, updateTaskData } from './tasks.js';



// ==================== NAVEGACIÓN ENTRE PANTALLAS ====================
export function showHomeScreen() {
  document.getElementById('home-screen').style.display = 'block';
  document.getElementById('app').style.display = 'none';
}

export function showBoardScreen() {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

// ==================== HEADER DEL TABLERO ====================
export function updateProjectHeader(project) {
  document.getElementById('project-title').textContent = project.name;
  document.getElementById('project-subtitle').textContent =
    'Arrastra las tarjetas o usa el menú «⋯» para moverlas de columna.';
}

export function setSyncNote(text) {
  document.getElementById('sync-note').textContent = text;
}

export function applyProfilePill(profile, authUser) {
  document.getElementById('profile-name').textContent = profile.name;
  document.getElementById('profile-avatar').textContent = initials(profile.name);
  document.getElementById('profile-avatar').style.background = colorForName(profile.name);
}

// ==================== HOME: GRID DE TABLEROS ====================
// Renderiza la lista de tableros agregando el botón de eliminación individual
export function renderHomeGrid(boards, onSelect, onDelete) {
  const grid = document.getElementById('home-grid');
  grid.innerHTML = '';

  if (!boards.length) {
    grid.innerHTML = `
      <div class="empty-hint">
        Todavía no tienes tableros. Crea el primero con «+ Nuevo tablero»,
        o pide a un compañero que te comparta su enlace de invitación.
      </div>`;
    return;
  }

  boards.forEach(b => {
    const card = document.createElement('div');
    card.className = 'board-card';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span class="board-card-dot" style="background:${colorForName(b.name)}"></span>
        <!-- Botón para eliminar el tablero -->
        <button class="menu-btn delete-board-btn" title="Eliminar tablero" style="color:var(--danger); font-size:14px; padding:2px 6px;">✕</button>
      </div>
      <span class="board-card-name">${escapeHtml(b.name)}</span>
      <span class="board-card-tag">${b.role === 'owner' ? 'Administrador' : 'Invitado'}</span>
    `;

    // Abrir tablero al hacer clic en la tarjeta (si no se presionó el botón de borrar)
    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('delete-board-btn')) {
        onSelect(b);
      }
    });

    // Evento para la acción de eliminar
    const deleteBtn = card.querySelector('.delete-board-btn');
    if (deleteBtn && onDelete) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDelete(b);
      });
    }

    grid.appendChild(card);
  });
}

  boards.forEach(b => {
    const card = document.createElement('button');
    card.className = 'board-card';
    card.innerHTML = `
      <span class="board-card-dot" style="background:${colorForName(b.name)}"></span>
      <span class="board-card-name">${escapeHtml(b.name)}</span>
      <span class="board-card-tag">${b.role === 'owner' ? 'Administrador' : 'Invitado'}</span>
    `;
    card.addEventListener('click', () => onSelect(b));
    grid.appendChild(card);
  });
}

export function updateHomeProfilePill(label) {
  document.getElementById('home-profile-name').textContent = label;
  document.getElementById('home-profile-avatar').textContent = initials(label);
  document.getElementById('home-profile-avatar').style.background = colorForName(label);
}

export function setHomeAuthButton(text, onClick) {
  const btn = document.getElementById('home-auth-btn');
  btn.textContent = text;
  btn.onclick = onClick;
}

// ==================== TOAST ====================
let toastTimer = null;
export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

// ==================== MODALES ====================
export function openProfileModal(profile, authUser) {
  const overlay = document.getElementById('profile-modal');
  const input = document.getElementById('profile-input');
  const saveBtn = document.getElementById('profile-save');
  const guestMessage = document.getElementById('guest-message');
  const signupBtn = document.getElementById('profile-signup-btn');
  const colorOptions = document.getElementById('profile-color-options');

  // Limpiar opciones de color
  colorOptions.innerHTML = '';

  // Determinar color seleccionado actual
  const selectedColor = profile?.color || 
    (profile?.name ? colorForName(profile.name) : 
    (authUser?.email ? colorForName(authUser.email) : '#d9a441'));

  // Generar círculos de color usando TAPE_PALETTE
  TAPE_PALETTE.forEach(color => {
    const circle = document.createElement('div');
    circle.className = 'color-circle' + (color === selectedColor ? ' selected' : '');
    circle.style.background = color;
    circle.dataset.color = color;
    circle.addEventListener('click', () => {
      document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('selected'));
      circle.classList.add('selected');
      overlay.dataset.selectedColor = color;
    });
    colorOptions.appendChild(circle);
  });

  // Guardar color seleccionado en el modal
  overlay.dataset.selectedColor = selectedColor;

  // Mostrar mensaje de invitado si no hay usuario autenticado
  if (!authUser) {
    guestMessage.style.display = 'block';
    signupBtn.onclick = () => {
      closeProfileModal();
      openAuthModal();
    };
  } else {
    guestMessage.style.display = 'none';
  }

  // Rellenar campo de nombre
  input.value = profile?.name || '';
  saveBtn.disabled = !input.value.trim();

  overlay.classList.remove('hidden');
  setTimeout(() => input.focus(), 50);
}

export function closeProfileModal() {
  document.getElementById('profile-modal').classList.add('hidden');
}

export function openAddTaskModal() {
  document.getElementById('new-task-text').value = '';
  document.getElementById('new-task-date').value = '';
  document.getElementById('add-task-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('new-task-text').focus(), 50);
}

export function closeAddTaskModal() {
  document.getElementById('add-task-modal').classList.add('hidden');
}

// Modal para CREAR un tablero nuevo (ya no funciona como selector/lista)
export function openProjectModal() {
  document.getElementById('new-project-name').value = '';
  document.getElementById('create-project-btn').disabled = true;
  document.getElementById('project-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('new-project-name').focus(), 50);
}

export function closeProjectModal() {
  document.getElementById('project-modal').classList.add('hidden');
}

export function openAuthModal() {
  document.getElementById('auth-modal').classList.remove('hidden');
  document.getElementById('signup-modal').classList.add('hidden');
  setTimeout(() => document.getElementById('auth-email').focus(), 50);
}

export function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

export function openSignupModal() {
  document.getElementById('signup-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('signup-email').focus(), 50);
}

export function closeSignupModal() {
  document.getElementById('signup-modal').classList.add('hidden');
}

export function setAuthMessage(msg) {
  document.getElementById('auth-message').textContent = msg;
}

// Variable en memoria a nivel de módulo para rastrear el ID de la tarjeta arrastrada
let currentDraggingTaskId = null;

// ==================== TABLERO ====================
export function renderBoard(tasks, profile, isMetricsCollapsed, onMetricsToggle, refresh, projectId) {
  const board = document.getElementById('board');
  board.innerHTML = '';

  // Renderiza las tres columnas de tareas
  COLUMN_DEFS.forEach(col => {
    const colTasks = tasks.filter(t => t.column_id === col.id);
    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.dataset.columnId = col.id;

    // Eventos de arrastrar y soltar
    colEl.addEventListener('dragover', (e) => { e.preventDefault(); colEl.classList.add('drag-over'); });
    colEl.addEventListener('dragleave', () => colEl.classList.remove('drag-over'));
colEl.addEventListener('drop', (e) => {
  e.preventDefault();
  colEl.classList.remove('drag-over');
  // Usamos la variable en memoria en lugar de consultar localStorage
  if (currentDraggingTaskId) {
    moveTask(currentDraggingTaskId, col.id, profile.name, projectId);
    currentDraggingTaskId = null;
  }
});
    });

    // Encabezado de columna
    const head = document.createElement('div');
    head.className = 'column-head';
    head.innerHTML = `
      <span class="column-dot" style="background:${col.accent}"></span>
      <span class="column-title">${col.title}</span>
      <span class="column-count">${colTasks.length}</span>
    `;
    colEl.appendChild(head);

    // Contenedor de tarjetas
    const cardsEl = document.createElement('div');
    cardsEl.className = 'cards';
    if (colTasks.length === 0) {
      cardsEl.innerHTML = '<div class="empty-hint">Sin tarjetas todavía</div>';
    } else {
      colTasks.forEach(task => cardsEl.appendChild(renderCard(task, profile, refresh, projectId)));
    }
    colEl.appendChild(cardsEl);

    // Botón para añadir tarea solo en la columna "Por hacer"
    if (col.id === 'todo') {
      const addRow = document.createElement('div');
      addRow.className = 'add-row';
      const addBtn = document.createElement('button');
      addBtn.className = 'add-btn';
      addBtn.textContent = '+ Nueva tarea';
      addBtn.addEventListener('click', () => openAddTaskModal());
      addRow.appendChild(addBtn);
      colEl.appendChild(addRow);
    }

    board.appendChild(colEl);
  });

  // Añade el panel de métricas
  board.appendChild(createMetricsPanel(tasks, isMetricsCollapsed, onMetricsToggle));
}

// ==================== TARJETA ====================
function renderCard(task, profile, refresh, projectId) {
  const card = document.createElement('div');
  const isDone = task.column_id === 'done';
  card.className = 'card' + (isDone ? ' card--done' : '');
  card.draggable = true;
  card.dataset.id = task.id;

  // Evento de arrastre
card.addEventListener('dragstart', () => {
  // Guardamos el ID directamente en la variable local
  currentDraggingTaskId = task.id;
  card.classList.add('dragging');
});

card.addEventListener('dragend', () => {
  card.classList.remove('dragging');
  currentDraggingTaskId = null;
});

  // Cinta superior (nombre del autor o "Hecho")
  let tapeHtml = '';
  if (isDone) {
    tapeHtml = '<div class="tape" style="background:#369C35; color:#ffffff;">Hecho</div>';
  } else if (task.author) {
    
// Asigna el color del avatar: solo usa el color personalizado si la tarea pertenece al usuario actual
const tapeColor = task.author
  ? (task.author === profile?.name && profile?.color ? profile.color : colorForName(task.author))
  : 'rgba(255,255,255,.28)';
    
tapeHtml = `<div class="tape" style="background:${tapeColor}">${escapeHtml(task.author)}</div>`;
  } else {
    tapeHtml = '<div class="tape" style="background:rgba(255,255,255,.28)"></div>';
  }

  // Etiqueta de fecha límite
  let alertHtml = '';
  if (task.due_date) {
    const due = new Date(task.due_date);
    due.setMinutes(due.getMinutes() + due.getTimezoneOffset());
    if (!isDone) {
      const now = new Date();
      now.setHours(0,0,0,0);
      const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 0) {
        alertHtml = `<div class="badge-due overdue">⚠️ Venció el ${due.toLocaleDateString()}</div>`;
      } else if (diffDays <= 2) {
        alertHtml = `<div class="badge-due warning">⏱️ Vence pronto (${due.toLocaleDateString()})</div>`;
      } else {
        alertHtml = `<div class="badge-due ok">📅 Para el ${due.toLocaleDateString()}</div>`;
      }
    }
  }

  // Menú contextual
  const menuId = 'menu-' + task.id;
  card.innerHTML = `
    ${tapeHtml}
    <div class="card-actions" style="position:absolute; top:8px; right:6px;">
      <button class="menu-btn" data-open="${menuId}">⋯</button>
      <div class="menu" id="${menuId}">
        <div class="menu-label">Mover a</div>
        ${COLUMN_DEFS.filter(c => c.id !== task.column_id).map(c =>
          `<button data-move="${c.id}">${c.title}</button>`).join('')}
        <div class="menu-label">Otras acciones</div>
        <button data-edit="1">Editar tarjeta</button>
        <button class="danger" data-delete="1">Eliminar tarjeta</button>
      </div>
    </div>
    ${alertHtml}
    <div class="card-text"></div>
    <div class="card-meta">
      <span class="card-time">${timeAgo(task.created_at)}</span>
    </div>
  `;

  // Asignar texto
  card.querySelector('.card-text').textContent = task.text;

  // Eventos del menú
  const menuBtn = card.querySelector('.menu-btn');
  const menu = card.querySelector('.menu');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
    menu.classList.toggle('open');
  });

  menu.querySelectorAll('[data-move]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      moveTask(task.id, btn.dataset.move, profile.name, projectId);
      menu.classList.remove('open');
    });
  });

  menu.querySelector('[data-edit]').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.remove('open');
    startEdit(card, task, profile, refresh, projectId);
  });

  menu.querySelector('[data-delete]').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id, projectId);
    menu.classList.remove('open');
  });

  return card;
}

// ==================== EDICIÓN EN LÍNEA ====================
function startEdit(card, task, profile, refresh, projectId) {
  const textEl = card.querySelector('.card-text');
  card.draggable = false;

  const wrapper = document.createElement('div');
  wrapper.className = 'edit-wrapper';
  wrapper.innerHTML = `
    <textarea class="edit-textarea" rows="3"></textarea>
    <label class="input-label" style="margin-top:6px;">Fecha límite (opcional)</label>
    <input type="date" class="date-input" value="${task.due_date || ''}">
    <div class="edit-actions" style="margin-top:8px;">
      <button class="edit-cancel">Cancelar</button>
      <button class="edit-save">Guardar</button>
    </div>
  `;

  const textarea = wrapper.querySelector('textarea');
  const dateInput = wrapper.querySelector('input[type="date"]');
  textarea.value = task.text;

  textEl.replaceWith(wrapper);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  wrapper.querySelector('.edit-cancel').addEventListener('click', () => {
    refresh(); // simplemente re-renderiza desde el estado actual
  });

  wrapper.querySelector('.edit-save').addEventListener('click', () => {
    const newText = textarea.value.trim();
    if (!newText) return;
    updateTaskData(task.id, newText, dateInput.value, projectId);
    // No re-renderizamos aquí; el realtime se encargará
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      wrapper.querySelector('.edit-save').click();
    }
    if (e.key === 'Escape') {
      refresh();
    }
  });
}

// ==================== MÉTRICAS ====================
function createMetricsPanel(tasks, isCollapsed, onToggle) {
  const colEl = document.createElement('div');
  colEl.className = 'column metrics-column' + (isCollapsed ? ' collapsed' : '');

  const head = document.createElement('div');
  head.className = 'column-head';
  head.innerHTML = `
    <span class="column-dot" style="background:var(--white)"></span>
    <span class="column-title">Participación</span>
    <button class="metrics-toggle ${isCollapsed ? 'collapsed' : ''}">▼</button>
  `;
  colEl.appendChild(head);

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'metrics-content' + (isCollapsed ? ' hidden' : '');

  const listEl = document.createElement('div');
  listEl.className = 'cards';

  const stats = {};
  tasks.forEach(t => {
    if (!t.author) return;
    if (!stats[t.author]) stats[t.author] = { done: 0, pending: 0 };
    if (t.column_id === 'done') stats[t.author].done++;
    else if (t.column_id === 'doing') stats[t.author].pending++;
  });

  const authors = Object.keys(stats);
  if (authors.length === 0) {
    listEl.innerHTML = '<div class="empty-hint">Asigna tarjetas para ver las métricas.</div>';
  } else {
    authors.forEach(author => {
      const data = stats[author];
      const total = data.done + data.pending;
      const percent = total === 0 ? 0 : Math.round((data.done / total) * 100);

      const item = document.createElement('div');
      item.className = 'metric-item';
      item.innerHTML = `
        <div class="metric-name">
          <span class="column-dot" style="background:${colorForName(author)}"></span>
          ${escapeHtml(author)}
        </div>
        <div class="metric-stats">
          <div class="metric-stat"><span>${data.done}</span> listas</div>
          <div class="metric-stat"><span>${data.pending}</span> pend.</div>
          <div class="metric-stat" style="margin-left:auto;"><span>${percent}%</span></div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${percent}%;"></div>
        </div>
      `;
      listEl.appendChild(item);
    });
  }

  contentWrapper.appendChild(listEl);
  colEl.appendChild(contentWrapper);

  // Botón para plegar/desplegar métricas
  const toggleBtn = head.querySelector('.metrics-toggle');
  toggleBtn.addEventListener('click', onToggle);

  return colEl;
}
