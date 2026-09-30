-- Deshace la migración 014 (vuelve a las políticas y funciones anteriores).
-- No toca datos. OJO: al volver atrás, cualquier usuario puede otra vez
-- cambiar su propio `plan`.

drop trigger if exists proteger_columnas_profiles on public.profiles;
drop function if exists public.proteger_columnas_profiles();

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "asignaturas_all_own" on public.asignaturas;
create policy "asignaturas_all_own" on public.asignaturas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "universidades_canonicas_insert_pendiente" on public.universidades_canonicas
  for insert to authenticated with check (estado = 'pendiente');
create policy "carreras_canonicas_insert_pendiente" on public.carreras_canonicas
  for insert to authenticated with check (estado = 'pendiente');
create policy "asignaturas_canonicas_insert_pendiente" on public.asignaturas_canonicas
  for insert to authenticated with check (estado = 'pendiente');
create policy "universidades_alias_insert_auth" on public.universidades_alias
  for insert to authenticated with check (true);
create policy "carreras_alias_insert_auth" on public.carreras_alias
  for insert to authenticated with check (true);
create policy "asignaturas_alias_insert_auth" on public.asignaturas_alias
  for insert to authenticated with check (true);

-- Las funciones crear_*_pendiente vuelven a SECURITY INVOKER.
alter function public.crear_universidad_pendiente(text, text) security invoker;
alter function public.crear_carrera_pendiente(uuid, text) security invoker;
alter function public.crear_asignatura_pendiente(uuid, text, numeric) security invoker;

drop function if exists public.curso_es_mio(uuid);
drop function if exists private.curso_es_mio(uuid);
drop function if exists public.asignatura_es_mia(uuid);
drop function if exists private.asignatura_es_mia(uuid);
