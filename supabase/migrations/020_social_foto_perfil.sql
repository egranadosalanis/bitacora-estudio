-- ============================================================
-- Migración 020: foto de perfil en Social.
--   * perfil_social.avatar_url: solo se admite una foto de Google
--     (https://lh3.googleusercontent.com/...), para que nadie pueda poner una
--     dirección propia que rastree a quien la vea.
--   * perfil_social.show_avatar: interruptor para ocultar la foto (por defecto visible).
--   * buscar_usuarios, mis_amistades y resumen_amigo devuelven avatar_url
--     (solo si show_avatar es true).
-- No borra datos. Rollback: rollback/020_volver_a_sin_foto.sql
-- ============================================================

alter table public.perfil_social
  add column if not exists avatar_url text,
  add column if not exists show_avatar boolean not null default true;

alter table public.perfil_social drop constraint if exists perfil_social_avatar_formato;
alter table public.perfil_social add constraint perfil_social_avatar_formato
  check (avatar_url is null or (length(avatar_url) <= 400 and avatar_url ~ '^https://lh3\.googleusercontent\.com/[A-Za-z0-9_/=.-]+$'));

create or replace function public.establecer_avatar(p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_url text := nullif(trim(coalesce(p_url, '')), '');
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  update public.perfil_social set avatar_url = v_url, updated_at = now() where user_id = auth.uid();
  if not found then raise exception 'sin_perfil_social' using errcode = 'P0002'; end if;
exception
  when check_violation then raise exception 'avatar_invalido' using errcode = '22023';
end;
$fn$;

create or replace function public.establecer_mostrar_foto(p_mostrar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  update public.perfil_social set show_avatar = p_mostrar, updated_at = now() where user_id = auth.uid();
  if not found then raise exception 'sin_perfil_social' using errcode = 'P0002'; end if;
end;
$fn$;

drop function if exists public.mis_amistades();
create function public.mis_amistades()
returns table (id uuid, username text, verificado boolean, avatar_url text, estado text, direccion text)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.id, ps.username, ps.verificado, case when ps.show_avatar then ps.avatar_url end, a.estado,
         case when a.solicitante = auth.uid() then 'enviada' else 'recibida' end
  from public.amistades a
  join public.perfil_social ps
    on ps.user_id = case when a.solicitante = auth.uid() then a.receptor else a.solicitante end
  where auth.uid() in (a.solicitante, a.receptor)
    and (a.estado in ('pendiente', 'aceptada') or (a.estado = 'bloqueada' and a.bloqueado_por = auth.uid()))
  order by a.estado, ps.username
$fn$;

drop function if exists public.buscar_usuarios(text);
create function public.buscar_usuarios(p_query text)
returns table (username text, verificado boolean, avatar_url text)
language sql
stable
security definer
set search_path = public
as $fn$
  select ps.username, ps.verificado, case when ps.show_avatar then ps.avatar_url end
  from public.perfil_social ps
  where auth.uid() is not null
    and ps.user_id <> auth.uid()
    and trim(p_query) <> ''
    and (
      (length(trim(p_query)) >= 3 and starts_with(lower(ps.username), lower(trim(p_query))))
      or lower(ps.username) = lower(trim(p_query))
    )
    and not exists (
      select 1 from public.amistades a
      where a.estado = 'bloqueada' and a.bloqueado_por = ps.user_id
        and least(a.solicitante, a.receptor) = least(auth.uid(), ps.user_id)
        and greatest(a.solicitante, a.receptor) = greatest(auth.uid(), ps.user_id)
    )
  order by ps.verificado desc, ps.username
  limit 10
$fn$;

create or replace function public.resumen_amigo(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_notas boolean;
  v_res jsonb;
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;

  if not coalesce((select share_metrics_ok from public.perfil_social where user_id = v_me), false) then
    raise exception 'consentimiento_propio_requerido' using errcode = '42501';
  end if;

  select ps.user_id, ps.show_grades into v_other, v_notas
  from public.perfil_social ps
  where lower(ps.username) = lower(trim(p_username)) and ps.share_metrics_ok
    and exists (
      select 1 from public.amistades a
      where a.estado = 'aceptada'
        and least(a.solicitante, a.receptor) = least(v_me, ps.user_id)
        and greatest(a.solicitante, a.receptor) = greatest(v_me, ps.user_id)
    );
  -- Mismo error si no existe, no sois amigos o no ha aceptado: no se revela cuál.
  if v_other is null then raise exception 'no_disponible' using errcode = '42501'; end if;

  with subj as (
    select row_number() over (order by a.created_at, a.id) as ref, a.id, a.creditos, a.estado, a.color,
           a.es_erasmus, a.frozen_nota, a.frozen_cursos_necesarios,
           coalesce(case when a.asignatura_canonica_id is not null and a.es_erasmus is not true and c.estado <> 'rechazada'
                         then c.nombre_oficial end, a.nombre) as nombre,
           (c.no_credits is true) as sin_creditos
    from public.asignaturas a
    left join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
    where a.user_id = v_other
  ),
  own as (
    select asignatura_id, sum(minutos)::bigint as minutos from public.entradas_estudio
    where user_id = v_other group by asignatura_id
  ),
  det as (
    select s.*, coalesce(o.minutos, 0) as minutos,
           -- Aprobadas: sus minutos + los de las fusionadas ya aprobadas (Erasmus...).
           case when s.estado = 'aprobada' then (
             select coalesce(sum(e.minutos), 0) from public.entradas_estudio e
             where e.asignatura_id = s.id
                or e.asignatura_id in (select x.id from public.asignaturas x where x.asignatura_equivalente_id = s.id and x.estado = 'aprobada')
           ) end as minutos_computables
    from subj s left join own o on o.asignatura_id = s.id
  ),
  tot as (
    select coalesce(sum(minutos), 0) as minutos_totales, count(*) as n_asignaturas,
           sum(minutos_computables) filter (where estado = 'aprobada' and es_erasmus is not true and not sin_creditos and creditos > 0) as min_apr,
           sum(creditos) filter (where estado = 'aprobada' and es_erasmus is not true and not sin_creditos and creditos > 0) as cred_apr
    from det
  )
  select jsonb_build_object(
    'username', (select username from public.perfil_social where user_id = v_other),
    'verificado', (select verificado from public.perfil_social where user_id = v_other),
    'avatar_url', (select case when show_avatar then avatar_url end from public.perfil_social where user_id = v_other),
    'mostrar_notas', v_notas,
    'minutos_totales', tot.minutos_totales,
    'n_asignaturas', tot.n_asignaturas,
    'horas_por_credito', case when coalesce(tot.cred_apr, 0) > 0 then round(tot.min_apr / 60.0 / tot.cred_apr, 3) end,
    'asignaturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref', d.ref, 'nombre', d.nombre, 'creditos', d.creditos, 'estado', d.estado, 'color', d.color,
        'es_erasmus', d.es_erasmus, 'sin_creditos', d.sin_creditos, 'minutos', d.minutos,
        'horas_por_credito', case when d.estado = 'aprobada' and d.es_erasmus is not true and not d.sin_creditos and d.creditos > 0
                                  then round(d.minutos_computables / 60.0 / d.creditos, 3) end,
        'cursos_necesarios', case when d.estado = 'aprobada' then d.frozen_cursos_necesarios end,
        'nota', case when v_notas and d.estado = 'aprobada' then d.frozen_nota end
      ) order by d.ref) from det d), '[]'::jsonb),
    'historial', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', h.fecha, 'ref', h.ref, 'minutos', h.minutos) order by h.fecha, h.ref)
      from (
        select e.fecha, s.ref, sum(e.minutos)::int as minutos
        from public.entradas_estudio e join subj s on s.id = e.asignatura_id
        where e.user_id = v_other group by e.fecha, s.ref
      ) h), '[]'::jsonb)
  ) into v_res
  from tot;

  return v_res;
end;
$fn$;

do $fn$
declare f text;
begin
  foreach f in array array[
    'establecer_avatar(text)', 'establecer_mostrar_foto(boolean)', 'mis_amistades()', 'buscar_usuarios(text)', 'resumen_amigo(text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$fn$;
