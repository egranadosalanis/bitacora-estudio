-- ============================================================
-- Migración 015: Social — perfil social y amistades.
--
-- Tablas nuevas: perfil_social y amistades. Ninguna se escribe directamente
-- desde la app: solo se puede leer lo propio, y todo cambio pasa por las
-- funciones de más abajo (que validan y fijan fechas/versiones en el servidor).
-- No toca datos existentes. Rollback: rollback/015_volver_a_sin_social.sql
-- ============================================================

create table if not exists public.perfil_social (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  username text not null,
  share_metrics_ok boolean not null default false,
  share_metrics_at timestamptz,
  share_metrics_version text,
  share_ranking_ok boolean not null default false,
  share_ranking_at timestamptz,
  share_ranking_version text,
  show_grades boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perfil_social_username_formato check (username ~ '^[A-Za-z0-9_.]{3,20}$'),
  constraint perfil_social_metrics_consta check (not share_metrics_ok or (share_metrics_at is not null and share_metrics_version is not null)),
  constraint perfil_social_ranking_consta check (not share_ranking_ok or (share_ranking_at is not null and share_ranking_version is not null))
);

create unique index if not exists perfil_social_username_lower on public.perfil_social (lower(username));

create table if not exists public.amistades (
  id uuid primary key default gen_random_uuid(),
  solicitante uuid not null references public.profiles(id) on delete cascade,
  receptor uuid not null references public.profiles(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada', 'bloqueada')),
  bloqueado_por uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amistades_no_consigo_mismo check (solicitante <> receptor),
  constraint amistades_bloqueo_consta check ((estado = 'bloqueada') = (bloqueado_por is not null))
);

-- Una sola fila por pareja, sin importar quién pidió a quién.
create unique index if not exists amistades_pareja_unica
  on public.amistades (least(solicitante, receptor), greatest(solicitante, receptor));

alter table public.perfil_social enable row level security;
alter table public.amistades enable row level security;

drop policy if exists "perfil_social_select_own" on public.perfil_social;
create policy "perfil_social_select_own" on public.perfil_social
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "amistades_select_partes" on public.amistades;
create policy "amistades_select_partes" on public.amistades
  for select to authenticated using (auth.uid() = solicitante or auth.uid() = receptor);

-- Defensa en profundidad: sin permisos de escritura sobre las tablas.
revoke all on public.perfil_social from anon, authenticated;
revoke all on public.amistades from anon, authenticated;
grant select on public.perfil_social to authenticated;
grant select on public.amistades to authenticated;

-- ---------- perfil social ----------

create or replace function public.crear_perfil_social(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid(); v_u text := trim(p_username);
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if exists (select 1 from public.perfil_social where user_id = v_me) then
    raise exception 'perfil_ya_existe' using errcode = 'PS001';
  end if;
  insert into public.perfil_social (user_id, username) values (v_me, v_u);
exception
  when unique_violation then raise exception 'username_en_uso' using errcode = '23505';
  when check_violation then raise exception 'username_invalido' using errcode = '22023';
end;
$fn$;

create or replace function public.cambiar_username(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  update public.perfil_social set username = trim(p_username), updated_at = now() where user_id = v_me;
  if not found then raise exception 'sin_perfil_social' using errcode = 'P0002'; end if;
exception
  when unique_violation then raise exception 'username_en_uso' using errcode = '23505';
  when check_violation then raise exception 'username_invalido' using errcode = '22023';
end;
$fn$;

-- p_tipo: 'metricas' (compartir con amigos) o 'ranking' (listado de aprobados).
-- Aceptar guarda fecha y versión del texto; retirar surte efecto al instante
-- porque todas las consultas sociales comprueban el valor actual.
create or replace function public.establecer_consentimiento(p_tipo text, p_acepta boolean, p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if p_tipo not in ('metricas', 'ranking') then raise exception 'tipo_invalido' using errcode = '22023'; end if;
  if p_acepta and coalesce(trim(p_version), '') = '' then raise exception 'version_requerida' using errcode = '22023'; end if;

  if p_tipo = 'metricas' then
    update public.perfil_social set
      share_metrics_ok = p_acepta,
      share_metrics_at = case when p_acepta then now() else share_metrics_at end,
      share_metrics_version = case when p_acepta then trim(p_version) else share_metrics_version end,
      updated_at = now()
    where user_id = v_me;
  else
    update public.perfil_social set
      share_ranking_ok = p_acepta,
      share_ranking_at = case when p_acepta then now() else share_ranking_at end,
      share_ranking_version = case when p_acepta then trim(p_version) else share_ranking_version end,
      updated_at = now()
    where user_id = v_me;
  end if;
  if not found then raise exception 'sin_perfil_social' using errcode = 'P0002'; end if;
end;
$fn$;

create or replace function public.establecer_mostrar_notas(p_mostrar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  update public.perfil_social set show_grades = p_mostrar, updated_at = now() where user_id = auth.uid();
  if not found then raise exception 'sin_perfil_social' using errcode = 'P0002'; end if;
end;
$fn$;

-- ---------- amistades ----------

create or replace function public.solicitar_amistad(p_username text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid(); v_other uuid; v_est text; v_id uuid;
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if not exists (select 1 from public.perfil_social where user_id = v_me) then
    raise exception 'sin_perfil_social' using errcode = 'P0002';
  end if;

  select user_id into v_other from public.perfil_social where lower(username) = lower(trim(p_username));
  if v_other is null or v_other = v_me then
    raise exception 'usuario_no_encontrado' using errcode = 'P0002';
  end if;

  select estado into v_est from public.amistades
  where least(solicitante, receptor) = least(v_me, v_other) and greatest(solicitante, receptor) = greatest(v_me, v_other);
  if found then
    -- Si te bloqueó, se responde igual que si no existiera (no se revela).
    if v_est = 'bloqueada' then raise exception 'usuario_no_encontrado' using errcode = 'P0002'; end if;
    raise exception 'solicitud_existente' using errcode = '23505';
  end if;

  insert into public.amistades (solicitante, receptor) values (v_me, v_other) returning id into v_id;
  return v_id;
exception
  when unique_violation then raise exception 'solicitud_existente' using errcode = '23505';
end;
$fn$;

create or replace function public.responder_solicitud(p_id uuid, p_acepta boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  update public.amistades
  set estado = case when p_acepta then 'aceptada' else 'rechazada' end, updated_at = now()
  where id = p_id and receptor = auth.uid() and estado = 'pendiente';
  if not found then raise exception 'solicitud_no_encontrada' using errcode = 'P0002'; end if;
end;
$fn$;

-- Quita a un amigo o cancela una solicitud pendiente. Después se puede volver a solicitar.
create or replace function public.quitar_amistad(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid(); v_other uuid;
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  select user_id into v_other from public.perfil_social where lower(username) = lower(trim(p_username));
  delete from public.amistades
  where v_other is not null and estado in ('aceptada', 'pendiente')
    and least(solicitante, receptor) = least(v_me, v_other) and greatest(solicitante, receptor) = greatest(v_me, v_other);
  if not found then raise exception 'amistad_no_encontrada' using errcode = 'P0002'; end if;
end;
$fn$;

create or replace function public.bloquear_usuario(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid(); v_other uuid;
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  select user_id into v_other from public.perfil_social where lower(username) = lower(trim(p_username));
  if v_other is null or v_other = v_me then raise exception 'usuario_no_encontrado' using errcode = 'P0002'; end if;

  -- Si ya te había bloqueado la otra persona, se deja como está.
  update public.amistades set estado = 'bloqueada', bloqueado_por = v_me, updated_at = now()
  where least(solicitante, receptor) = least(v_me, v_other) and greatest(solicitante, receptor) = greatest(v_me, v_other)
    and not (estado = 'bloqueada' and bloqueado_por <> v_me);
  if not found and not exists (
    select 1 from public.amistades
    where least(solicitante, receptor) = least(v_me, v_other) and greatest(solicitante, receptor) = greatest(v_me, v_other)
  ) then
    insert into public.amistades (solicitante, receptor, estado, bloqueado_por) values (v_me, v_other, 'bloqueada', v_me);
  end if;
end;
$fn$;

create or replace function public.desbloquear_usuario(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid(); v_other uuid;
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  select user_id into v_other from public.perfil_social where lower(username) = lower(trim(p_username));
  delete from public.amistades
  where v_other is not null and estado = 'bloqueada' and bloqueado_por = v_me
    and least(solicitante, receptor) = least(v_me, v_other) and greatest(solicitante, receptor) = greatest(v_me, v_other);
end;
$fn$;

-- Amistades y solicitudes propias, con el nombre de usuario de la otra parte.
-- No muestra las rechazadas ni los bloqueos que te hizo la otra persona.
create or replace function public.mis_amistades()
returns table (id uuid, username text, estado text, direccion text)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.id, ps.username, a.estado,
         case when a.solicitante = auth.uid() then 'enviada' else 'recibida' end
  from public.amistades a
  join public.perfil_social ps
    on ps.user_id = case when a.solicitante = auth.uid() then a.receptor else a.solicitante end
  where auth.uid() in (a.solicitante, a.receptor)
    and (a.estado in ('pendiente', 'aceptada') or (a.estado = 'bloqueada' and a.bloqueado_por = auth.uid()))
  order by a.estado, ps.username
$fn$;

-- ---------- permisos ----------
do $fn$
declare f text;
begin
  foreach f in array array[
    'crear_perfil_social(text)', 'cambiar_username(text)', 'establecer_consentimiento(text, boolean, text)',
    'establecer_mostrar_notas(boolean)', 'solicitar_amistad(text)', 'responder_solicitud(uuid, boolean)',
    'quitar_amistad(text)', 'bloquear_usuario(text)', 'desbloquear_usuario(text)', 'mis_amistades()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$fn$;
