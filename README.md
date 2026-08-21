EquiTeam
> Servicio para la organización y mejora del rendimiento en trabajos grupales.
Demo en vivo: https://equiteam-app.github.io/Equiteam/
---
🚀 ¿Qué es?
EquiTeam es un tablero colaborativo tipo Kanban diseñado para equipos de trabajo académico o profesional. Permite crear tableros, gestionar tareas en columnas (Por hacer / En progreso / Hecho), asignar responsables y visualizar métricas de participación del equipo.
Características principales:
✅ Crear tableros de equipo con un solo click
✅ Arrastrar tarjetas entre columnas (drag & drop)
✅ Asignar responsables a cada tarea con cinta de color
✅ Fechas límite con alertas visuales (vencido / próximo / futuro)
✅ Panel de métricas de participación por miembro
✅ Sincronización en tiempo real con Supabase Realtime
✅ Acceso sin cuenta para invitados (solo con el enlace)
✅ Autenticación por email + contraseña para creadores de tableros
---
🛠️ Stack Tecnológico
Capa	Tecnología
Frontend	HTML5, CSS3, JavaScript vanilla (ES Modules)
Backend / BD	Supabase (PostgreSQL + Auth + Realtime)
Hosting	GitHub Pages
Tipografía	Google Fonts (Fraunces + Work Sans)
---
📁 Estructura del proyecto
```
Equiteam/
├── index.html          # Interfaz principal (home + tablero + modales)
├── css/
│   └── styles.css      # Estilos globales, responsive, variables CSS
└── js/
    ├── app.js          # Orquestador principal: estado, navegación, eventos
    ├── auth.js         # Autenticación con Supabase (email/password)
    ├── config.js       # Constantes: Supabase keys, paleta de colores, columnas
    ├── projects.js     # CRUD de proyectos y gestión de URLs de invitación
    ├── supabase.js     # Cliente de Supabase inicializado
    ├── tasks.js        # CRUD de tareas (fetch, add, move, delete, update)
    ├── ui.js           # Renderizado del DOM, modales, tarjetas, métricas
    └── utils.js        # Helpers: colorForName, initials, timeAgo, escapeHtml
```
---
⚙️ Configuración de Supabase
1. Crear proyecto en Supabase
Ve a supabase.com y crea un nuevo proyecto.
Copia la URL del proyecto y la anon key (Project Settings → API).
Pega ambos valores en `js/config.js`:
```javascript
export const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
export const SUPABASE_ANON_KEY = 'tu-anon-key';
```
2. Crear tablas
Abre el SQL Editor de Supabase y ejecuta el siguiente script para crear las tablas y activar RLS:
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de proyectos (tableros)
CREATE TABLE public.projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

-- Tabla de miembros de proyecto
CREATE TABLE public.project_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Tabla de tareas
CREATE TABLE public.tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  column_id   text NOT NULL DEFAULT 'todo',
  text        text NOT NULL,
  author      text,
  due_date    date,
  created_at  timestamptz DEFAULT now()
);

-- Activar Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Políticas: projects
CREATE POLICY "projects_public_select" ON public.projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "projects_owner_insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "projects_owner_update" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "projects_owner_delete" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Políticas: project_members
CREATE POLICY "members_read" ON public.project_members FOR SELECT TO authenticated USING (
  auth.uid() IN (SELECT pm.user_id FROM public.project_members pm WHERE pm.project_id = project_members.project_id)
);
CREATE POLICY "owner_insert_members" ON public.project_members FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IN (SELECT pm.user_id FROM public.project_members pm WHERE pm.project_id = project_members.project_id AND pm.role = 'owner')
  OR auth.uid() = (SELECT p.created_by FROM public.projects p WHERE p.id = project_members.project_id)
);
CREATE POLICY "owner_delete_members" ON public.project_members FOR DELETE TO authenticated USING (
  auth.uid() IN (SELECT pm.user_id FROM public.project_members pm WHERE pm.project_id = project_members.project_id AND pm.role = 'owner')
);

-- Políticas: tasks (permissive para invitados sin cuenta)
CREATE POLICY "tasks_public_select" ON public.tasks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tasks_public_insert" ON public.tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "tasks_public_update" ON public.tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tasks_public_delete" ON public.tasks FOR DELETE TO anon, authenticated USING (true);
```
3. Activar Realtime
En Supabase, ve a Database → Replication y activa la replicación para la tabla `tasks`. Esto permite que los cambios aparezcan en tiempo real en todas las pestañas abiertas.
---
🖥️ Ejecutar localmente
Como el proyecto usa ES Modules y `import`/`export`, necesitas servirlo con un servidor local (no basta con abrir `index.html` directamente).
Opción rápida con Python:
```bash
cd Equiteam
python3 -m http.server 8080
# Abre http://localhost:8080
```
Opción con Node.js (Vite):
```bash
cd Equiteam
npx vite
# Abre http://localhost:5173
```
Opción con VS Code:
Instala la extensión Live Server, haz click derecho en `index.html` → Open with Live Server.
---
🎨 Personalización
Las variables de diseño están centralizadas en `css/styles.css` dentro de `:root`:
```css
:root {
  --bg: #1f3a34;        /* Fondo principal */
  --card: #f6efe1;      /* Color de tarjetas */
  --todo: #d9a441;      /* Columna "Por hacer" */
  --doing: #5b87a6;     /* Columna "En progreso" */
  --done: #7fa65b;      /* Columna "Hecho" */
  --danger: #c0563f;    /* Alertas y acciones destructivas */
}
```
La paleta de colores de las cintas de avatar está en `js/config.js`:
```javascript
export const TAPE_PALETTE = [
  '#d9a441', '#5b87a6', '#7fa65b', '#c0563f',
  '#8a6fb0', '#4f9d8a', '#c77b9a'
];
```
---
🔐 Seguridad
RLS (Row Level Security) está activo en todas las tablas.
Solo usuarios autenticados pueden crear proyectos.
Solo el creador (owner) puede modificar o eliminar su proyecto.
Las tareas son públicas para permitir el flujo de invitados sin cuenta. Si necesitas mayor seguridad, considera implementar tokens de invitación.
---
📄 Licencia
MIT © EquiTeam
