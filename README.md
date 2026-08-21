EquiTeam
Servicio para la organizacion y mejora del rendimiento en trabajos grupales.
Demo: equiteam-app.github.io/Equiteam
---
Acerca de EquiTeam 
Es un tablero colaborativo tipo Kanban orientado a equipos de trabajo. Permite crear tableros, gestionar tareas en tres estados (Por hacer, En progreso, Hecho), asignar responsables y visualizar metricas de participacion del equipo.
Funcionalidades principales:
Creacion de tableros con un solo click.
Arrastre de tarjetas entre columnas (drag and drop).
Asignacion de responsables con indicadores de color.
Fechas limite con alertas visuales segun proximidad.
Panel de metricas de participacion por miembro.
Sincronizacion en tiempo real mediante Supabase Realtime.
Acceso para invitados sin necesidad de cuenta (solo con el enlace).
Autenticacion por correo y contrasena para creadores de tableros.
---
Stack
Capa	Tecnologia
Frontend	HTML5, CSS3, JavaScript (ES Modules)
Backend / Base de datos	Supabase (PostgreSQL, Auth, Realtime)
Hosting	GitHub Pages
Tipografia	Fraunces, Work Sans (Google Fonts)
---
Estructura
```
Equiteam/
|-- index.html          Interfaz principal (home, tablero, modales)
|-- css/
|   -- styles.css       Estilos globales, responsive, variables CSS
|-- js/
    |-- app.js          Orquestador principal: estado, navegacion, eventos
    |-- auth.js         Autenticacion con Supabase (correo/contrasena)
    |-- config.js       Constantes: credenciales Supabase, paleta, columnas
    |-- projects.js     CRUD de proyectos y gestion de enlaces de invitacion
    |-- supabase.js     Cliente de Supabase inicializado
    |-- tasks.js        CRUD de tareas
    |-- ui.js           Renderizado del DOM, modales, tarjetas, metricas
    -- utils.js         Helpers: colorForName, initials, timeAgo, escapeHtml
```
---
Configuracion de Supabase
1. Crear proyecto
Ve a supabase.com y crea un nuevo proyecto.
Copia la URL del proyecto y la anon key desde Project Settings > API.
Pega ambos valores en `js/config.js`:
```javascript
export const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
export const SUPABASE_ANON_KEY = 'tu-anon-key';
```
2. Crear tablas
Abre el SQL Editor de Supabase y ejecuta lo siguiente:
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.project_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE TABLE public.tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  column_id   text NOT NULL DEFAULT 'todo',
  text        text NOT NULL,
  author      text,
  due_date    date,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- projects
CREATE POLICY "projects_public_select" ON public.projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "projects_owner_insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "projects_owner_update" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "projects_owner_delete" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- project_members
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

-- tasks (permissive para invitados sin cuenta)
CREATE POLICY "tasks_public_select" ON public.tasks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tasks_public_insert" ON public.tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "tasks_public_update" ON public.tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tasks_public_delete" ON public.tasks FOR DELETE TO anon, authenticated USING (true);
```
3. Activar Realtime
En Supabase, ve a Database > Replication y activa la replicacion para la tabla `tasks`. Esto permite que los cambios se reflejen en tiempo real en todas las pestanas abiertas.
---
Ejecucion local
El proyecto usa ES Modules, por lo que requiere un servidor local. No basta con abrir `index.html` directamente.
Con Python:
```bash
cd Equiteam
python3 -m http.server 8080
```
Luego abre `http://localhost:8080`.
Con Node.js (Vite):
```bash
cd Equiteam
npx vite
```
Luego abre `http://localhost:5173`.
Con VS Code:
Instala la extension Live Server, haz click derecho en `index.html` y selecciona "Open with Live Server".
---
Personalizacion
Las variables de diseno estan en `css/styles.css` dentro de `:root`:
```css
:root {
  --bg: #1f3a34;
  --card: #f6efe1;
  --todo: #d9a441;
  --doing: #5b87a6;
  --done: #7fa65b;
  --danger: #c0563f;
}
```
La paleta de colores de las cintas de avatar esta en `js/config.js`:
```javascript
export const TAPE_PALETTE = [
  '#d9a441', '#5b87a6', '#7fa65b', '#c0563f',
  '#8a6fb0', '#4f9d8a', '#c77b9a'
];
```
---
Seguridad
Row Level Security (RLS) esta activo en todas las tablas.
Solo usuarios autenticados pueden crear proyectos.
Solo el creador (owner) puede modificar o eliminar su proyecto.
Las tareas son publicas para permitir el flujo de invitados sin cuenta. Para un nivel adicional de seguridad, considera implementar tokens de invitacion.
---
Licencia
MIT
