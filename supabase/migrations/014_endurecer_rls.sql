-- ============================================================
-- Migración 014: endurecer RLS antes de lanzar la pestaña Social.
--
-- Qué arregla (ver el diagnóstico en la conversación):
--   1. Cualquier usuario podía ponerse `plan = 'premium_...'` con su propia
--      sesión (la política de update dejaba cambiar cualquier columna de su
--      fila de profiles). Ahora `plan`, `email` y `premium_promo_granted_at`
--      solo los puede cambiar el service_role (panel admin / Edge Function).
--      Lo mismo al crear el perfil: solo se admite `plan = 'free'`.
--   2. asignaturas: una asignatura no puede apuntar a un curso ni a una
--      asignatura "equivalente" de otro usuario.
--   3. Alta de universidades/carreras/asignaturas canónicas y de alias: ya no
--      se inserta directamente desde el cliente (se podían poner marcas
--      Erasmus/sin créditos, un created_by ajeno, o alias basura). Solo se
--      puede a través de las funciones crear_*_pendiente, que ahora son
--      SECURITY DEFINER y fijan ellas mismas los valores.
--   4. Avisos de Advisors: search_path fijo en las funciones, y
--      handle_new_user deja de ser ejecutable por anon/authenticated.
--
-- No toca ni borra datos. Es idempotente. Rollback:
-- supabase/rollback/014_volver_a_rls_anterior.sql
-- Ejecutar en el SQL Editor de Supabase (Run) y después
-- supabase/verificaciones/014_verificar_rls.sql.
-- ============================================================

-- ---------- 1. profiles ----------

create or replace function public.proteger_columnas_profiles()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- current_user es 'authenticated'/'anon' cuando la petición viene de la app
  -- con la clave anon; con la service_role key o desde el SQL Editor es otro.
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id
       or new.plan is distinct from old.plan
       or new.email is distinct from old.email
       or new.premium_promo_granted_at is distinct from old.premium_promo_granted_at then
      raise exception 'No puedes modificar el plan, el email ni el id de tu perfil.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_columnas_profiles on public.profiles;
create trigger proteger_columnas_profiles
  before update on public.profiles
  for each row execute function public.proteger_columnas_profiles();

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id and plan = 'free' and premium_promo_granted_at is null);

-- ---------- 2. asignaturas ----------

drop policy if exists "asignaturas_all_own" on public.asignaturas;
create policy "asignaturas_all_own" on public.asignaturas
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (origin_curso_id is null or exists (
      select 1 from public.cursos c where c.id = origin_curso_id and c.user_id = auth.uid()
    ))
    and (asignatura_equivalente_id is null or exists (
      select 1 from public.asignaturas a where a.id = asignatura_equivalente_id and a.user_id = auth.uid()
    ))
  );

-- ---------- 3. canónicas y alias: solo vía funciones ----------

drop policy if exists "universidades_canonicas_insert_pendiente" on public.universidades_canonicas;
drop policy if exists "carreras_canonicas_insert_pendiente" on public.carreras_canonicas;
drop policy if exists "asignaturas_canonicas_insert_pendiente" on public.asignaturas_canonicas;
drop policy if exists "universidades_alias_insert_auth" on public.universidades_alias;
drop policy if exists "carreras_alias_insert_auth" on public.carreras_alias;
drop policy if exists "asignaturas_alias_insert_auth" on public.asignaturas_alias;

create or replace function public.crear_universidad_pendiente(p_nombre text, p_pais text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '42501';
  end if;

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
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '42501';
  end if;

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
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '42501';
  end if;

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

-- create or replace conserva los permisos, pero se reafirman por seguridad.
revoke execute on function public.crear_universidad_pendiente(text, text) from public, anon, authenticated;
revoke execute on function public.crear_carrera_pendiente(uuid, text) from public, anon, authenticated;
revoke execute on function public.crear_asignatura_pendiente(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.crear_universidad_pendiente(text, text) to authenticated;
grant execute on function public.crear_carrera_pendiente(uuid, text) to authenticated;
grant execute on function public.crear_asignatura_pendiente(uuid, text, numeric) to authenticated;

-- ---------- 4. avisos de Advisors ----------

alter function public.normalizar_texto(text) set search_path = public;
alter function public.buscar_universidades(text, int) set search_path = public;
alter function public.buscar_carreras(uuid, text, int) set search_path = public;
alter function public.buscar_asignaturas_canonicas(uuid, text, int) set search_path = public;

-- Función de trigger: no tiene por qué poder llamarse por la API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.proteger_columnas_profiles() from public, anon, authenticated;
