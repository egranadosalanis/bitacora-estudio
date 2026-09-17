# Bitácora · Admin

Panel privado (solo para ti, el creador de Bitácora de Estudio) para ver datos y
estadísticas agregadas de todos los usuarios de la app: altas, actividad,
minutos estudiados, planes, universidades/carreras y el detalle de cada usuario.

Es una aplicación **completamente separada** de la app principal, pensada para
desplegarse aparte y poder abrirse tanto desde el móvil como desde el
ordenador con una URL propia.

## Cómo funciona (y por qué es seguro)

La app principal usa Row Level Security en Supabase: cada usuario solo puede
leer sus propias filas con la clave `anon`. Este panel necesita ver los datos
de **todos** los usuarios, así que usa la **`service_role` key** de Supabase,
que salta el RLS.

Esa clave nunca debe llegar al navegador. Por eso el panel tiene dos partes:

- **Frontend** (`src/`): React + Vite + Recharts. Solo hace login contra
  Supabase Auth con la clave `anon` (igual que la app principal) y pide los
  datos a `/api/*`.
- **Backend** (`api/`): funciones serverless (pensadas para Vercel) que usan
  la `service_role` key. Antes de devolver nada, comprueban que el token de
  la petición pertenece a una sesión de Supabase Auth **cuyo email coincide
  con `ADMIN_EMAIL`** — cualquier otra cuenta recibe 403, aunque haya iniciado
  sesión correctamente.

Así puedes entrar desde cualquier dispositivo con tu email/contraseña (o el
método que uses en Supabase Auth) y solo tu cuenta puede ver los datos.

## 1. Configurar variables de entorno

Copia `.env.example` a `.env` para desarrollo local y rellénalo:

```
VITE_SUPABASE_URL=...          # igual que en la app principal
VITE_SUPABASE_ANON_KEY=...     # igual que en la app principal (clave anon, pública)
SUPABASE_URL=...               # la misma URL del proyecto
SUPABASE_SERVICE_ROLE_KEY=...  # Project Settings -> API -> service_role (SECRETA)
ADMIN_EMAIL=tu-email@ejemplo.com
```

La `service_role key` la encuentras en el dashboard de Supabase, en
**Project Settings -> API -> service_role secret**. No la compartas ni la subas
al repo (el `.gitignore` ya excluye `.env*`).

`ADMIN_EMAIL` debe ser el email de una cuenta que ya exista en Supabase Auth
del mismo proyecto (por ejemplo tu propia cuenta de la app principal, o una
nueva que crees solo para esto).

## 2. Desarrollo local

Las funciones de `api/` necesitan el runtime de Vercel, así que para probar
todo junto (frontend + API) usa la CLI de Vercel:

```bash
npm install -g vercel   # una vez
cd admin
vercel dev
```

Si solo quieres iterar en la interfaz sin backend real, `npm run dev` (Vite)
también sirve, pero las llamadas a `/api/*` fallarán.

## 3. Desplegar (acceso desde móvil y PC)

Con [Vercel](https://vercel.com) (gratis para este uso):

1. Crea un proyecto nuevo en Vercel apuntando a este repositorio.
2. En **Root Directory** elige `admin` (importante: no la raíz del repo).
3. Vercel detecta Vite automáticamente. No hace falta tocar el build command.
4. En **Environment Variables** añade las 5 variables de `.env.example` con
   sus valores reales (`SUPABASE_SERVICE_ROLE_KEY` y `ADMIN_EMAIL` inclusive).
5. Despliega. Vercel te da una URL (`https://tu-panel.vercel.app`) — instálala
   como acceso directo / "Añadir a pantalla de inicio" en el móvil para que
   se sienta como una app.

Cualquier otro proveedor con soporte de funciones serverless en `/api`
(Node) también valdría, pero las instrucciones aquí están pensadas para Vercel.

## Qué muestra

- **Resumen**: usuarios totales, activos (7/30 días), minutos estudiados
  totales, altas por semana, minutos por semana, distribución de planes,
  universidades y carreras con más usuarios.
- **Usuarios**: tabla buscable y ordenable con plan, universidad, cursos,
  asignaturas, minutos totales y última actividad. Al hacer clic en una fila
  se abre el detalle: evolución de sus minutos de estudio, asignaturas por
  minutos, y lista de cursos.

## Notas

- Solo lectura: el panel no modifica datos de los usuarios.
- Si en algún momento quieres dar acceso a alguien más, añade su email a
  `ADMIN_EMAIL` como lista separada por comas y ajusta la comprobación en
  `api/_lib/requireAdmin.js`.
