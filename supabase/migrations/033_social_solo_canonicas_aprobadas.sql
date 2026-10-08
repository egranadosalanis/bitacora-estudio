-- ============================================================
-- Migración 033: las asignaturas NO canónicas no cuentan en las estadísticas sociales.
--   Hasta que el admin apruebe la canónica (estado = 'aprobada'), una asignatura creada a mano
--   (texto libre, canónica pendiente o rechazada) no suma a nadie más que a su dueño:
--     * resumen_amigo (lo que ven los demás): la asignatura NO aparece en la ficha (ni minutos, ni historial,
--       ni h/cr), así que no suma puntos de rango ni racha. Solo la ve su dueño.
--     * mi_resumen (lo que ve el dueño): la asignatura aparece con 'cuenta' = false ("no puntúa"); sus
--       minutos no entran en minutos_totales ni h/cr, y el cliente la excluye de puntos de rango y racha.
--     * clasificacion_global: solo suman las horas de asignaturas con canónica aprobada.
--     * _aprobados (comunidad_stats, listado_aprobados, detalle_aprobado): solo canónicas aprobadas.
--   Las de Erasmus siguen contando (no tienen canónica por diseño). Las marcadas «sin créditos» siguen sin contar.
--   La app del propio usuario no cambia: sus datos y su rango personal siguen igual.
-- No toca datos. Rollback: rollback/033_volver_a_no_canonicas_suman.sql
-- Ejecutar en el SQL Editor de Supabase (Run).
-- ============================================================

create or replace function public._aprobados(p_canonica uuid)
returns table (user_id uuid, asignatura_id uuid, minutos numeric, hpc numeric, nota numeric, cursos_necesarios int)
language sql
stable
security definer
set search_path = public
as $fn$
  select u.user_id, g.base_id, g.minutos, g.minutos / 60.0 / g.creditos, g.nota, g.cursos
  from (select distinct a.user_id from public.asignaturas a where a.asignatura_canonica_id = p_canonica) u
  cross join lateral public._grupos_aprobados(u.user_id) g
  join public.asignaturas_canonicas c on c.id = g.canonica
  where g.canonica = p_canonica
    and c.is_erasmus is not true and c.no_credits is not true and c.estado = 'aprobada'
    and g.creditos > 0 and g.minutos > 0
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

  with ga as (select * from public._grupos_aprobados(v_other)),
  subj as (
    select row_number() over (order by a.created_at, a.id) as ref, a.id, a.creditos, a.estado, a.color,
           a.es_erasmus, a.frozen_nota, a.frozen_cursos_necesarios,
           coalesce(case when a.asignatura_canonica_id is not null and a.es_erasmus is not true and c.estado <> 'rechazada'
                         then c.nombre_oficial end, a.nombre) as nombre,
           (c.no_credits is true) as sin_creditos,
           (a.es_erasmus is true or c.estado = 'aprobada') as cuenta
    from public.asignaturas a
    left join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
    where a.user_id = v_other
      and (a.es_erasmus is true or c.estado = 'aprobada')
  ),
  own as (
    select asignatura_id, sum(minutos)::bigint as minutos from public.entradas_estudio
    where user_id = v_other group by asignatura_id
  ),
  det as (
    select s.*, coalesce(o.minutos, 0) as minutos,
           ga.minutos as minutos_computables, ga.cursos as cursos_grupo, ga.nota as nota_grupo,
           (ga.base_id is not null) as aprobada_grupo
    from subj s
    left join own o on o.asignatura_id = s.id
    left join ga on ga.base_id = s.id
  ),
  tot as (
    select coalesce(sum(minutos) filter (where cuenta), 0) as minutos_totales, count(*) as n_asignaturas,
           sum(minutos_computables) filter (where aprobada_grupo and cuenta and not sin_creditos and creditos > 0) as min_apr,
           sum(creditos) filter (where aprobada_grupo and cuenta and not sin_creditos and creditos > 0) as cred_apr
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
        'ref', d.ref, 'nombre', d.nombre, 'creditos', d.creditos, 'estado', case when d.aprobada_grupo then 'aprobada' else d.estado end, 'color', d.color,
        'es_erasmus', d.es_erasmus, 'sin_creditos', d.sin_creditos, 'cuenta', d.cuenta, 'minutos', d.minutos,
        'horas_por_credito', case when d.aprobada_grupo and d.cuenta and not d.sin_creditos and d.creditos > 0
                                  then round(d.minutos_computables / 60.0 / d.creditos, 3) end,
        'cursos_necesarios', d.cursos_grupo,
        'nota', case when v_notas then d.nota_grupo end
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

  with ga as (select * from public._grupos_aprobados(v_me)),
  subj as (
    select row_number() over (order by a.created_at, a.id) as ref, a.id, a.creditos, a.estado, a.color,
           a.es_erasmus, a.frozen_nota, a.frozen_cursos_necesarios,
           coalesce(case when a.asignatura_canonica_id is not null and a.es_erasmus is not true and c.estado <> 'rechazada'
                         then c.nombre_oficial end, a.nombre) as nombre,
           (c.no_credits is true) as sin_creditos,
           (a.es_erasmus is true or c.estado = 'aprobada') as cuenta
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
           ga.minutos as minutos_computables, ga.cursos as cursos_grupo, ga.nota as nota_grupo,
           (ga.base_id is not null) as aprobada_grupo
    from subj s
    left join own o on o.asignatura_id = s.id
    left join ga on ga.base_id = s.id
  ),
  tot as (
    select coalesce(sum(minutos) filter (where cuenta), 0) as minutos_totales, count(*) as n_asignaturas,
           sum(minutos_computables) filter (where aprobada_grupo and cuenta and not sin_creditos and creditos > 0) as min_apr,
           sum(creditos) filter (where aprobada_grupo and cuenta and not sin_creditos and creditos > 0) as cred_apr
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
        'ref', d.ref, 'nombre', d.nombre, 'creditos', d.creditos, 'estado', case when d.aprobada_grupo then 'aprobada' else d.estado end, 'color', d.color,
        'es_erasmus', d.es_erasmus, 'sin_creditos', d.sin_creditos, 'cuenta', d.cuenta, 'minutos', d.minutos,
        'horas_por_credito', case when d.aprobada_grupo and d.cuenta and not d.sin_creditos and d.creditos > 0
                                  then round(d.minutos_computables / 60.0 / d.creditos, 3) end,
        'cursos_necesarios', d.cursos_grupo,
        'nota', case when v_notas then d.nota_grupo end
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

create or replace function public.clasificacion_global(p_inicio date, p_fin date, p_limite int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_lim int := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_res jsonb;
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if p_inicio is null or p_fin is null or p_fin < p_inicio or p_fin - p_inicio > 200 then
    raise exception 'rango_invalido' using errcode = '22023';
  end if;
  if not coalesce((select share_global_ok from public.perfil_social where user_id = v_me), false) then
    raise exception 'consentimiento_global_requerido' using errcode = '42501';
  end if;

  with agg as (
    select e.user_id, sum(e.minutos)::int as minutos, count(distinct e.fecha)::int as dias
    from public.entradas_estudio e
    join public.asignaturas a on a.id = e.asignatura_id
    left join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
    join public.perfil_social ps on ps.user_id = e.user_id and ps.share_global_ok
    where e.fecha between p_inicio and p_fin
      and coalesce(c.no_credits, false) = false
      and (a.es_erasmus is true or c.estado = 'aprobada')
      and (
        e.user_id = v_me
        or not exists (
          select 1 from public.amistades b
          where b.estado = 'bloqueada'
            and least(b.solicitante, b.receptor) = least(v_me, e.user_id)
            and greatest(b.solicitante, b.receptor) = greatest(v_me, e.user_id)
        )
      )
    group by e.user_id
    having sum(e.minutos) > 0
  ),
  ranked as (
    select agg.user_id, agg.minutos, agg.dias, ps.username, ps.verificado,
           case when ps.show_avatar then ps.avatar_url end as avatar_url,
           case when ps.show_avatar then ps.avatar_path end as avatar_path,
           row_number() over (order by agg.minutos desc, lower(ps.username)) as pos
    from agg join public.perfil_social ps on ps.user_id = agg.user_id
  )
  select jsonb_build_object(
    'total', (select count(*) from ranked),
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pos', r.pos, 'username', r.username, 'verificado', r.verificado,
        'avatar_url', r.avatar_url, 'avatar_path', r.avatar_path,
        'minutos', r.minutos, 'dias', r.dias, 'yo', r.user_id = v_me
      ) order by r.pos) from ranked r where r.pos <= v_lim), '[]'::jsonb),
    'yo', (
      select jsonb_build_object(
        'pos', r.pos, 'username', r.username, 'verificado', r.verificado,
        'avatar_url', r.avatar_url, 'avatar_path', r.avatar_path,
        'minutos', r.minutos, 'dias', r.dias, 'yo', true
      ) from ranked r where r.user_id = v_me)
  ) into v_res;

  return v_res;
end;
$fn$;

revoke execute on function public.clasificacion_global(date, date, int) from public, anon, authenticated;
grant execute on function public.clasificacion_global(date, date, int) to authenticated;
