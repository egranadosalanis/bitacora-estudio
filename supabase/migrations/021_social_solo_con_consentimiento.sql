-- ============================================================
-- Migración 021: Social solo entre quienes han aceptado + índice para las guías.
--   * buscar_usuarios: hay que haber aceptado compartir métricas para buscar, y
--     solo aparecen los usuarios que también lo han aceptado (con su foto).
--   * solicitar_amistad: igual (quien pide y quien recibe han de haber aceptado).
--   * mis_amistades: la foto solo se devuelve si esa persona tiene el permiso activo.
--   * mi_resumen(): tu propio resumen, tal y como lo ve un amigo.
--   * listado_aprobados: la nota solo se muestra si esa persona tiene activado "mostrar mis notas".
--   * Índice en entradas_estudio(asignatura_id, fecha): las estadísticas de la
--     Guía consultan por asignatura y, sin él, recorrían toda la tabla.
-- No borra datos. Rollback: rollback/021_volver_a_busqueda_abierta.sql
-- ============================================================

create index if not exists idx_entradas_asignatura_fecha on public.entradas_estudio (asignatura_id, fecha);
create index if not exists idx_asignaturas_equivalente on public.asignaturas (asignatura_equivalente_id) where asignatura_equivalente_id is not null;

create or replace function public.buscar_usuarios(p_query text)
returns table (username text, verificado boolean, avatar_url text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $fn$
  select ps.username, ps.verificado, case when ps.show_avatar then ps.avatar_url end, case when ps.show_avatar then ps.avatar_path end
  from public.perfil_social ps
  where auth.uid() is not null
    and coalesce((select me.share_metrics_ok from public.perfil_social me where me.user_id = auth.uid()), false)
    and ps.share_metrics_ok
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

create or replace function public.mis_amistades()
returns table (id uuid, username text, verificado boolean, avatar_url text, avatar_path text, estado text, direccion text)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.id, ps.username, ps.verificado,
         case when ps.show_avatar and ps.share_metrics_ok then ps.avatar_url end,
         case when ps.show_avatar and ps.share_metrics_ok then ps.avatar_path end,
         a.estado,
         case when a.solicitante = auth.uid() then 'enviada' else 'recibida' end
  from public.amistades a
  join public.perfil_social ps
    on ps.user_id = case when a.solicitante = auth.uid() then a.receptor else a.solicitante end
  where auth.uid() in (a.solicitante, a.receptor)
    and (a.estado in ('pendiente', 'aceptada') or (a.estado = 'bloqueada' and a.bloqueado_por = auth.uid()))
  order by a.estado, ps.username
$fn$;

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
  if not coalesce((select share_metrics_ok from public.perfil_social where user_id = v_me), false) then
    raise exception 'consentimiento_propio_requerido' using errcode = '42501';
  end if;

  select user_id into v_other from public.perfil_social
  where lower(username) = lower(trim(p_username)) and share_metrics_ok;
  if v_other is null or v_other = v_me then
    raise exception 'usuario_no_encontrado' using errcode = 'P0002';
  end if;

  select estado into v_est from public.amistades
  where least(solicitante, receptor) = least(v_me, v_other) and greatest(solicitante, receptor) = greatest(v_me, v_other);
  if found then
    if v_est = 'bloqueada' then raise exception 'usuario_no_encontrado' using errcode = 'P0002'; end if;
    raise exception 'solicitud_existente' using errcode = '23505';
  end if;

  insert into public.amistades (solicitante, receptor) values (v_me, v_other) returning id into v_id;
  return v_id;
exception
  when unique_violation then raise exception 'solicitud_existente' using errcode = '23505';
end;
$fn$;

-- Aprobados de una canónica (interna). Las horas suman las de la propia asignatura y las de
-- las fusionadas ya aprobadas; escrito con "in (... union all ...)" para poder usar el índice.
create or replace function public._aprobados(p_canonica uuid)
returns table (user_id uuid, asignatura_id uuid, minutos numeric, hpc numeric, nota numeric, cursos_necesarios int)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.user_id, a.id, m.minutos, m.minutos / 60.0 / a.creditos, a.frozen_nota, a.frozen_cursos_necesarios
  from public.asignaturas a
  join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
  cross join lateral (
    select coalesce(sum(e.minutos), 0)::numeric as minutos
    from public.entradas_estudio e
    where e.asignatura_id in (
      select a.id
      union all
      select x.id from public.asignaturas x where x.asignatura_equivalente_id = a.id and x.estado = 'aprobada'
    )
  ) m
  where a.asignatura_canonica_id = p_canonica
    and a.estado = 'aprobada'
    and a.es_erasmus is not true
    and c.is_erasmus is not true and c.no_credits is not true and c.estado <> 'rechazada'
    and a.creditos > 0 and m.minutos > 0
$fn$;

-- Ficha de un amigo (igual que antes, con la consulta de horas que usa el índice).
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
             where e.asignatura_id in (
               select s.id
               union all
               select x.id from public.asignaturas x where x.asignatura_equivalente_id = s.id and x.estado = 'aprobada')
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
    'avatar_path', (select case when show_avatar then avatar_path end from public.perfil_social where user_id = v_other),
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


-- Lo mismo que ve un amigo de ti (resumen_amigo), pero sobre tu propio perfil: sirve para
-- que cada persona compruebe exactamente qué se muestra de ella. Respeta tus ajustes.
create or replace function public.mi_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_notas boolean;
  v_res jsonb;
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  select show_grades into v_notas from public.perfil_social where user_id = v_me;
  if not found then raise exception 'sin_perfil_social' using errcode = 'P0002'; end if;

  with subj as (
    select row_number() over (order by a.created_at, a.id) as ref, a.id, a.creditos, a.estado, a.color,
           a.es_erasmus, a.frozen_nota, a.frozen_cursos_necesarios,
           coalesce(case when a.asignatura_canonica_id is not null and a.es_erasmus is not true and c.estado <> 'rechazada'
                         then c.nombre_oficial end, a.nombre) as nombre,
           (c.no_credits is true) as sin_creditos
    from public.asignaturas a
    left join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
    where a.user_id = v_me
  ),
  own as (
    select asignatura_id, sum(minutos)::bigint as minutos from public.entradas_estudio
    where user_id = v_me group by asignatura_id
  ),
  det as (
    select s.*, coalesce(o.minutos, 0) as minutos,
           -- Aprobadas: sus minutos + los de las fusionadas ya aprobadas (Erasmus...).
           case when s.estado = 'aprobada' then (
             select coalesce(sum(e.minutos), 0) from public.entradas_estudio e
             where e.asignatura_id in (
               select s.id
               union all
               select x.id from public.asignaturas x where x.asignatura_equivalente_id = s.id and x.estado = 'aprobada')
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
    'username', (select username from public.perfil_social where user_id = v_me),
    'verificado', (select verificado from public.perfil_social where user_id = v_me),
    'avatar_url', (select case when show_avatar then avatar_url end from public.perfil_social where user_id = v_me),
    'avatar_path', (select case when show_avatar then avatar_path end from public.perfil_social where user_id = v_me),
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
        where e.user_id = v_me group by e.fecha, s.ref
      ) h), '[]'::jsonb)
  ) into v_res
  from tot;

  return v_res;
end;
$fn$;

-- La nota del listado de aprobados solo se muestra si la persona tiene activado
-- "mostrar mis notas". Con las notas ocultas, tampoco se ordena por nota.
create or replace function public.listado_aprobados(p_canonica uuid)
returns table (username text, verificado boolean, horas_por_credito numeric, nota numeric, desgaste_maximo numeric, cursos_necesarios int)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if not coalesce((select share_ranking_ok from public.perfil_social where user_id = auth.uid()), false) then
    raise exception 'consentimiento_propio_requerido' using errcode = '42501';
  end if;

  return query
  select ps.username, ps.verificado, round(x.hpc, 2), case when ps.show_grades then x.nota end,
         public._desgaste_indice(x.asignatura_id), x.cursos_necesarios
  from public._aprobados(p_canonica) x
  join public.perfil_social ps on ps.user_id = x.user_id and ps.share_ranking_ok
  order by (case when ps.show_grades then x.nota end) desc nulls last, x.hpc, ps.username
  limit 200;
end;
$fn$;

do $fn$
declare f text;
begin
  foreach f in array array['mi_resumen()', 'resumen_amigo(text)', 'listado_aprobados(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  revoke execute on function public._aprobados(uuid) from public, anon, authenticated;
end;
$fn$;
