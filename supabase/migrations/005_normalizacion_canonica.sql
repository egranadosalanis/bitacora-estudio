-- ============================================================
-- Migración: normalización de universidades, carreras y
-- asignaturas (modelo canónico + alias).
--
-- Hasta ahora `profiles.universidad`/`carrera` y `asignaturas.nombre`
-- son texto libre: dos usuarios que escriben lo mismo de forma
-- distinta (tildes, mayúsculas, variantes) acaban siendo tratados
-- como cosas diferentes. Este archivo añade tablas "canónicas" (una
-- fila por universidad/carrera/asignatura real) y sus tablas de
-- "alias" (el texto tal cual lo escribió cada usuario, vinculado a
-- la fila canónica), más funciones de búsqueda difusa (pg_trgm) y de
-- alta/fusión.
--
-- ES SOLO ADITIVA: crea tablas y funciones nuevas y añade columnas
-- nullable a `profiles`/`asignaturas`. NO toca ni borra las columnas
-- de texto libre existentes (`profiles.universidad`, `.carrera`,
-- `asignaturas.nombre`) — se quedan tal cual mientras dure la
-- transición.
--
-- ES IDEMPOTENTE: todo usa `if not exists` / `create or replace`, y
-- las inserciones de las funciones de alta usan `on conflict do
-- nothing` sobre las columnas normalizadas únicas.
--
-- Ejecutar en el SQL Editor de Supabase (Run). Después, ejecutar
-- supabase/verificaciones/005_verificar_normalizacion.sql.
-- ============================================================

create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- ---------- normalización de texto ----------
-- unaccent(text) de un solo argumento es STABLE (depende de la
-- configuración de búsqueda por defecto), así que no se puede usar
-- dentro de una columna generada. La forma de dos argumentos, con el
-- diccionario fijado explícitamente, sí es IMMUTABLE.
create or replace function public.normalizar_texto(t text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(trim(regexp_replace(unaccent('unaccent', coalesce(t, '')), '\s+', ' ', 'g')))
$$;

revoke execute on function public.normalizar_texto(text) from public;
grant execute on function public.normalizar_texto(text) to authenticated, service_role;

-- ============================================================
-- Tablas canónicas
-- ============================================================

create table if not exists public.universidades_canonicas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_normalizado text generated always as (public.normalizar_texto(nombre)) stored,
  pais text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'fusionada', 'rechazada')),
  origen text not null default 'alta_libre' check (origen in ('alta_libre', 'migracion', 'seed')),
  fusionada_en_id uuid references public.universidades_canonicas(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (nombre_normalizado)
);

create table if not exists public.carreras_canonicas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_normalizado text generated always as (public.normalizar_texto(nombre)) stored,
  universidad_id uuid not null references public.universidades_canonicas(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'fusionada', 'rechazada')),
  origen text not null default 'alta_libre' check (origen in ('alta_libre', 'migracion', 'seed')),
  fusionada_en_id uuid references public.carreras_canonicas(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (universidad_id, nombre_normalizado)
);

create table if not exists public.asignaturas_canonicas (
  id uuid primary key default gen_random_uuid(),
  nombre_oficial text not null,
  nombre_normalizado text generated always as (public.normalizar_texto(nombre_oficial)) stored,
  carrera_id uuid not null references public.carreras_canonicas(id) on delete cascade,
  creditos numeric,
  -- Curso (1-4) y cuatrimestre ('A' anual, 'C1', 'C2', o el "tipo" de
  -- plan de estudios de origen, p. ej. 'FB'/'O'/'P' en la UC3M) tal
  -- cual constan en el listado oficial de la carrera.
  anio smallint,
  cuatrimestre text,
  plan text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'fusionada', 'rechazada')),
  origen text not null default 'alta_libre' check (origen in ('alta_libre', 'migracion', 'seed')),
  fusionada_en_id uuid references public.asignaturas_canonicas(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (carrera_id, nombre_normalizado)
);

-- ---------- alias ----------
-- Una tabla por tipo (no una tabla polimórfica): así cada alias lleva
-- una FK de verdad, con "on delete cascade" real, en vez de un
-- (tipo, entidad_id) sin integridad referencial.

create table if not exists public.universidades_alias (
  id uuid primary key default gen_random_uuid(),
  universidad_id uuid not null references public.universidades_canonicas(id) on delete cascade,
  texto_usuario text not null,
  texto_normalizado text generated always as (public.normalizar_texto(texto_usuario)) stored,
  created_at timestamptz not null default now(),
  unique (universidad_id, texto_normalizado)
);

create table if not exists public.carreras_alias (
  id uuid primary key default gen_random_uuid(),
  carrera_id uuid not null references public.carreras_canonicas(id) on delete cascade,
  texto_usuario text not null,
  texto_normalizado text generated always as (public.normalizar_texto(texto_usuario)) stored,
  created_at timestamptz not null default now(),
  unique (carrera_id, texto_normalizado)
);

create table if not exists public.asignaturas_alias (
  id uuid primary key default gen_random_uuid(),
  asignatura_id uuid not null references public.asignaturas_canonicas(id) on delete cascade,
  texto_usuario text not null,
  texto_normalizado text generated always as (public.normalizar_texto(texto_usuario)) stored,
  created_at timestamptz not null default now(),
  unique (asignatura_id, texto_normalizado)
);

-- ---------- índices de búsqueda difusa ----------
create index if not exists idx_universidades_canonicas_trgm on public.universidades_canonicas using gin (nombre_normalizado gin_trgm_ops);
create index if not exists idx_carreras_canonicas_trgm on public.carreras_canonicas using gin (nombre_normalizado gin_trgm_ops);
create index if not exists idx_asignaturas_canonicas_trgm on public.asignaturas_canonicas using gin (nombre_normalizado gin_trgm_ops);
create index if not exists idx_universidades_alias_trgm on public.universidades_alias using gin (texto_normalizado gin_trgm_ops);
create index if not exists idx_carreras_alias_trgm on public.carreras_alias using gin (texto_normalizado gin_trgm_ops);
create index if not exists idx_asignaturas_alias_trgm on public.asignaturas_alias using gin (texto_normalizado gin_trgm_ops);

-- ============================================================
-- Columnas de enlace en las tablas existentes (aditivas, nullable)
-- ============================================================

alter table public.profiles
  add column if not exists universidad_canonica_id uuid references public.universidades_canonicas(id) on delete set null,
  add column if not exists carrera_canonica_id uuid references public.carreras_canonicas(id) on delete set null;

alter table public.asignaturas
  add column if not exists asignatura_canonica_id uuid references public.asignaturas_canonicas(id) on delete set null,
  add column if not exists es_erasmus boolean not null default false;

create index if not exists idx_profiles_universidad_canonica on public.profiles(universidad_canonica_id);
create index if not exists idx_profiles_carrera_canonica on public.profiles(carrera_canonica_id);
create index if not exists idx_asignaturas_canonica on public.asignaturas(asignatura_canonica_id);

-- Asignaturas de un usuario que todavía no están ni vinculadas ni
-- marcadas Erasmus — es exactamente lo que la pantalla de migración
-- obligatoria (y el bloqueo de acceso a la app) tienen que dejar en
-- cero antes de dejar pasar al usuario.
create index if not exists idx_asignaturas_sin_normalizar on public.asignaturas(user_id)
  where asignatura_canonica_id is null and es_erasmus is not true;

-- ============================================================
-- Row Level Security
-- ============================================================
-- Lectura abierta a cualquier usuario autenticado (para que el
-- buscador encuentre universidades/carreras/asignaturas dadas de
-- alta por otros usuarios). Alta solo en estado 'pendiente' (nadie
-- puede auto-aprobarse una fila desde el cliente). Ningún update ni
-- delete para usuarios normales: todo cambio de estado pasa por las
-- funciones de más abajo o por el service_role del panel admin.

alter table public.universidades_canonicas enable row level security;
alter table public.carreras_canonicas enable row level security;
alter table public.asignaturas_canonicas enable row level security;
alter table public.universidades_alias enable row level security;
alter table public.carreras_alias enable row level security;
alter table public.asignaturas_alias enable row level security;

drop policy if exists "universidades_canonicas_select_auth" on public.universidades_canonicas;
create policy "universidades_canonicas_select_auth" on public.universidades_canonicas
  for select to authenticated using (true);
drop policy if exists "universidades_canonicas_insert_pendiente" on public.universidades_canonicas;
create policy "universidades_canonicas_insert_pendiente" on public.universidades_canonicas
  for insert to authenticated with check (estado = 'pendiente');

drop policy if exists "carreras_canonicas_select_auth" on public.carreras_canonicas;
create policy "carreras_canonicas_select_auth" on public.carreras_canonicas
  for select to authenticated using (true);
drop policy if exists "carreras_canonicas_insert_pendiente" on public.carreras_canonicas;
create policy "carreras_canonicas_insert_pendiente" on public.carreras_canonicas
  for insert to authenticated with check (estado = 'pendiente');

drop policy if exists "asignaturas_canonicas_select_auth" on public.asignaturas_canonicas;
create policy "asignaturas_canonicas_select_auth" on public.asignaturas_canonicas
  for select to authenticated using (true);
drop policy if exists "asignaturas_canonicas_insert_pendiente" on public.asignaturas_canonicas;
create policy "asignaturas_canonicas_insert_pendiente" on public.asignaturas_canonicas
  for insert to authenticated with check (estado = 'pendiente');

drop policy if exists "universidades_alias_select_auth" on public.universidades_alias;
create policy "universidades_alias_select_auth" on public.universidades_alias
  for select to authenticated using (true);
drop policy if exists "universidades_alias_insert_auth" on public.universidades_alias;
create policy "universidades_alias_insert_auth" on public.universidades_alias
  for insert to authenticated with check (true);

drop policy if exists "carreras_alias_select_auth" on public.carreras_alias;
create policy "carreras_alias_select_auth" on public.carreras_alias
  for select to authenticated using (true);
drop policy if exists "carreras_alias_insert_auth" on public.carreras_alias;
create policy "carreras_alias_insert_auth" on public.carreras_alias
  for insert to authenticated with check (true);

drop policy if exists "asignaturas_alias_select_auth" on public.asignaturas_alias;
create policy "asignaturas_alias_select_auth" on public.asignaturas_alias
  for select to authenticated using (true);
drop policy if exists "asignaturas_alias_insert_auth" on public.asignaturas_alias;
create policy "asignaturas_alias_insert_auth" on public.asignaturas_alias
  for insert to authenticated with check (true);

-- ============================================================
-- Búsqueda difusa (RPC, llamadas desde el cliente vía supabase.rpc)
-- ============================================================
-- Bajan el umbral de similitud de pg_trgm (0.3 por defecto) a 0.2
-- para esta sesión, porque los textos de origen suelen tener faltas
-- de tilde o errores de tecleo cortos.

create or replace function public.buscar_universidades(p_query text, p_limite int default 20)
returns table(id uuid, nombre text, pais text, estado text, score real)
language plpgsql
stable
security invoker
as $$
begin
  perform set_limit(0.2);
  return query
    select u.id, u.nombre, u.pais, u.estado,
           greatest(
             similarity(u.nombre_normalizado, public.normalizar_texto(p_query)),
             coalesce((select max(similarity(al.texto_normalizado, public.normalizar_texto(p_query)))
                       from public.universidades_alias al where al.universidad_id = u.id), 0)
           )::real as score
    from public.universidades_canonicas u
    where u.estado in ('aprobada', 'pendiente')
      and (
        p_query = ''
        or u.nombre_normalizado % public.normalizar_texto(p_query)
        or exists (
          select 1 from public.universidades_alias al
          where al.universidad_id = u.id and al.texto_normalizado % public.normalizar_texto(p_query)
        )
      )
    order by score desc, u.nombre asc
    limit p_limite;
end;
$$;

create or replace function public.buscar_carreras(p_universidad_id uuid, p_query text, p_limite int default 20)
returns table(id uuid, nombre text, estado text, score real)
language plpgsql
stable
security invoker
as $$
begin
  perform set_limit(0.2);
  return query
    select c.id, c.nombre, c.estado,
           greatest(
             similarity(c.nombre_normalizado, public.normalizar_texto(p_query)),
             coalesce((select max(similarity(al.texto_normalizado, public.normalizar_texto(p_query)))
                       from public.carreras_alias al where al.carrera_id = c.id), 0)
           )::real as score
    from public.carreras_canonicas c
    where c.universidad_id = p_universidad_id
      and c.estado in ('aprobada', 'pendiente')
      and (
        p_query = ''
        or c.nombre_normalizado % public.normalizar_texto(p_query)
        or exists (
          select 1 from public.carreras_alias al
          where al.carrera_id = c.id and al.texto_normalizado % public.normalizar_texto(p_query)
        )
      )
    order by score desc, c.nombre asc
    limit p_limite;
end;
$$;

create or replace function public.buscar_asignaturas_canonicas(p_carrera_id uuid, p_query text, p_limite int default 20)
returns table(id uuid, nombre_oficial text, creditos numeric, anio smallint, cuatrimestre text, plan text, estado text, score real)
language plpgsql
stable
security invoker
as $$
begin
  perform set_limit(0.2);
  return query
    select a.id, a.nombre_oficial, a.creditos, a.anio, a.cuatrimestre, a.plan, a.estado,
           greatest(
             similarity(a.nombre_normalizado, public.normalizar_texto(p_query)),
             coalesce((select max(similarity(al.texto_normalizado, public.normalizar_texto(p_query)))
                       from public.asignaturas_alias al where al.asignatura_id = a.id), 0)
           )::real as score
    from public.asignaturas_canonicas a
    where a.carrera_id = p_carrera_id
      and a.estado in ('aprobada', 'pendiente')
      and (
        p_query = ''
        or a.nombre_normalizado % public.normalizar_texto(p_query)
        or exists (
          select 1 from public.asignaturas_alias al
          where al.asignatura_id = a.id and al.texto_normalizado % public.normalizar_texto(p_query)
        )
      )
    order by score desc, a.nombre_oficial asc
    limit p_limite;
end;
$$;

-- ============================================================
-- Alta de fila "pendiente de aprobación" (idempotente: si el texto
-- normalizado ya existe, reutiliza la fila y solo añade el alias)
-- ============================================================

create or replace function public.crear_universidad_pendiente(p_nombre text, p_pais text default null)
returns uuid
language plpgsql
security invoker
as $$
declare v_id uuid;
begin
  insert into public.universidades_canonicas (nombre, pais, estado, origen, created_by)
  values (trim(p_nombre), p_pais, 'pendiente', 'alta_libre', auth.uid())
  on conflict (nombre_normalizado) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.universidades_canonicas
    where nombre_normalizado = public.normalizar_texto(p_nombre);
  end if;

  insert into public.universidades_alias (universidad_id, texto_usuario)
  values (v_id, trim(p_nombre))
  on conflict (universidad_id, texto_normalizado) do nothing;

  return v_id;
end;
$$;

create or replace function public.crear_carrera_pendiente(p_universidad_id uuid, p_nombre text)
returns uuid
language plpgsql
security invoker
as $$
declare v_id uuid;
begin
  insert into public.carreras_canonicas (nombre, universidad_id, estado, origen, created_by)
  values (trim(p_nombre), p_universidad_id, 'pendiente', 'alta_libre', auth.uid())
  on conflict (universidad_id, nombre_normalizado) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.carreras_canonicas
    where universidad_id = p_universidad_id and nombre_normalizado = public.normalizar_texto(p_nombre);
  end if;

  insert into public.carreras_alias (carrera_id, texto_usuario)
  values (v_id, trim(p_nombre))
  on conflict (carrera_id, texto_normalizado) do nothing;

  return v_id;
end;
$$;

create or replace function public.crear_asignatura_pendiente(p_carrera_id uuid, p_nombre text, p_creditos numeric default null)
returns uuid
language plpgsql
security invoker
as $$
declare v_id uuid;
begin
  insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, estado, origen, created_by)
  values (trim(p_nombre), p_carrera_id, p_creditos, 'pendiente', 'alta_libre', auth.uid())
  on conflict (carrera_id, nombre_normalizado) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.asignaturas_canonicas
    where carrera_id = p_carrera_id and nombre_normalizado = public.normalizar_texto(p_nombre);
  end if;

  insert into public.asignaturas_alias (asignatura_id, texto_usuario)
  values (v_id, trim(p_nombre))
  on conflict (asignatura_id, texto_normalizado) do nothing;

  return v_id;
end;
$$;

-- ============================================================
-- Fusión (solo panel de administración, vía service_role)
-- ============================================================
-- Repunta todas las filas de usuario que apuntaban al origen hacia
-- el destino, mueve/crea su alias, y dice al origen que ha sido
-- fusionado (nunca se borra: queda como alias del destino).

create or replace function public.fusionar_normalizacion(p_tipo text, p_origen uuid, p_destino uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tipo = 'universidad' then
    update public.profiles set universidad_canonica_id = p_destino where universidad_canonica_id = p_origen;
    update public.carreras_canonicas set universidad_id = p_destino where universidad_id = p_origen;
    update public.universidades_alias set universidad_id = p_destino where universidad_id = p_origen;
    insert into public.universidades_alias (universidad_id, texto_usuario)
      select p_destino, nombre from public.universidades_canonicas where id = p_origen
      on conflict (universidad_id, texto_normalizado) do nothing;
    update public.universidades_canonicas set estado = 'fusionada', fusionada_en_id = p_destino where id = p_origen;

  elsif p_tipo = 'carrera' then
    update public.profiles set carrera_canonica_id = p_destino where carrera_canonica_id = p_origen;
    update public.asignaturas_canonicas set carrera_id = p_destino where carrera_id = p_origen;
    update public.carreras_alias set carrera_id = p_destino where carrera_id = p_origen;
    insert into public.carreras_alias (carrera_id, texto_usuario)
      select p_destino, nombre from public.carreras_canonicas where id = p_origen
      on conflict (carrera_id, texto_normalizado) do nothing;
    update public.carreras_canonicas set estado = 'fusionada', fusionada_en_id = p_destino where id = p_origen;

  elsif p_tipo = 'asignatura' then
    update public.asignaturas set asignatura_canonica_id = p_destino where asignatura_canonica_id = p_origen;
    update public.asignaturas_alias set asignatura_id = p_destino where asignatura_id = p_origen;
    insert into public.asignaturas_alias (asignatura_id, texto_usuario)
      select p_destino, nombre_oficial from public.asignaturas_canonicas where id = p_origen
      on conflict (asignatura_id, texto_normalizado) do nothing;
    update public.asignaturas_canonicas set estado = 'fusionada', fusionada_en_id = p_destino where id = p_origen;

  else
    raise exception 'tipo desconocido: %', p_tipo;
  end if;
end;
$$;

-- ---------- permisos explícitos ----------
-- Primera vez que este esquema usa RPCs: en vez de fiarse del grant
-- por defecto a PUBLIC, se revoca y se concede exactamente a quien
-- debe poder llamar cada función.

revoke execute on function public.buscar_universidades(text, int) from public;
revoke execute on function public.buscar_carreras(uuid, text, int) from public;
revoke execute on function public.buscar_asignaturas_canonicas(uuid, text, int) from public;
revoke execute on function public.crear_universidad_pendiente(text, text) from public;
revoke execute on function public.crear_carrera_pendiente(uuid, text) from public;
revoke execute on function public.crear_asignatura_pendiente(uuid, text, numeric) from public;
revoke execute on function public.fusionar_normalizacion(text, uuid, uuid) from public;

grant execute on function public.buscar_universidades(text, int) to authenticated;
grant execute on function public.buscar_carreras(uuid, text, int) to authenticated;
grant execute on function public.buscar_asignaturas_canonicas(uuid, text, int) to authenticated;
grant execute on function public.crear_universidad_pendiente(text, text) to authenticated;
grant execute on function public.crear_carrera_pendiente(uuid, text) to authenticated;
grant execute on function public.crear_asignatura_pendiente(uuid, text, numeric) to authenticated;

grant execute on function public.fusionar_normalizacion(text, uuid, uuid) to service_role;
