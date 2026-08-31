-- ============================================================
-- Bitácora de Estudio -> Supabase: esquema inicial
-- Ejecutar TODO este archivo de una sola vez en el SQL Editor
-- de Supabase (Run). Es seguro ejecutarlo una sola vez sobre un
-- proyecto nuevo y vacío.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
-- Un perfil por usuario registrado (auth.users). Se crea solo,
-- automáticamente, vía el trigger de más abajo.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'premium_historico', 'premium_comparacion')),
  created_at timestamptz not null default now()
);

-- ---------- cursos ----------
-- Cursos académicos del usuario: solo un rango de fechas + estado.
create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  estado text not null default 'en_curso' check (estado in ('en_curso', 'terminado')),
  created_at timestamptz not null default now()
);

-- ---------- asignaturas ----------
create table public.asignaturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nombre text not null,
  creditos numeric not null,
  institucion text,
  origin_curso_id uuid references public.cursos(id) on delete set null,
  estado text not null default 'en_curso' check (estado in ('en_curso', 'suspendida', 'aprobada')),
  -- Asignatura "equivalente" (p. ej. la misma materia cursada en Erasmus
  -- con otro nombre): sus minutos cuentan también para la de destino.
  asignatura_equivalente_id uuid references public.asignaturas(id) on delete set null,
  color text,
  target numeric,
  -- Datos que se fijan para siempre al marcar la asignatura como aprobada.
  frozen_nota numeric,
  frozen_cursos_necesarios integer,
  frozen_fecha_aprobacion date,
  created_at timestamptz not null default now()
);

-- ---------- registros_estudio ----------
create table public.registros_estudio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asignatura_id uuid not null references public.asignaturas(id) on delete cascade,
  fecha date not null,
  minutos integer not null check (minutos > 0),
  created_at timestamptz not null default now(),
  unique (asignatura_id, fecha)
);

create index idx_cursos_user on public.cursos(user_id);
create index idx_asignaturas_user on public.asignaturas(user_id);
create index idx_registros_user on public.registros_estudio(user_id);
create index idx_registros_fecha on public.registros_estudio(fecha);

-- ============================================================
-- Row Level Security: cada usuario solo puede ver/editar sus
-- propias filas. Sin esto, cualquiera con la anon key podría leer
-- los datos de todo el mundo.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.cursos enable row level security;
alter table public.asignaturas enable row level security;
alter table public.registros_estudio enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "cursos_all_own" on public.cursos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "asignaturas_all_own" on public.asignaturas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "registros_all_own" on public.registros_estudio
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Crear el perfil automáticamente al registrarse (plan 'free' por
-- defecto; la cuenta del propio dueño se sube a mano después).
-- ============================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, plan)
  values (new.id, new.email, 'free');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
