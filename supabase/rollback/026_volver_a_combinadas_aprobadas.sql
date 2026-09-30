-- Deshace 026: restaura las funciones de 017/021/025. NO restaura los enlaces de "Combinar con" (se borraron).

create or replace function public.comunidad_stats(p_canonica uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare v_min int := public.social_min_n(); v_n int; v_res jsonb; v_excl boolean;
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;

  select (is_erasmus or no_credits) into v_excl from public.asignaturas_canonicas where id = p_canonica;
  if not found or v_excl then
    return jsonb_build_object('excluida', true);
  end if;

  select count(*) into v_n from public._aprobados(p_canonica);
  if v_n < v_min then
    return jsonb_build_object('n', v_n, 'min_n', v_min, 'suficiente', false);
  end if;

  with ap as (
    select x.*, public._desgaste_indice(x.asignatura_id) as desg from public._aprobados(p_canonica) x
  ), tot as (
    select count(*) as n, avg(hpc) as hpc_m, avg(minutos) as min_m,
           percentile_cont(0.25) within group (order by hpc) as q1,
           percentile_cont(0.75) within group (order by hpc) as q3,
           avg(desg) as desg_m, avg(cursos_necesarios) as cur_m,
           100.0 * count(*) filter (where cursos_necesarios = 1) / nullif(count(*) filter (where cursos_necesarios is not null), 0) as pct1
    from ap
  ), tr as (
    select t.tramo, t.lo, count(ap.asignatura_id) as n, avg(ap.hpc) as hpc_m, avg(ap.cursos_necesarios) as cur_m,
           avg(ap.desg) as desg_m,
           100.0 * count(*) filter (where ap.cursos_necesarios = 1) / nullif(count(*) filter (where ap.cursos_necesarios is not null), 0) as pct1
    from (values ('5-6.9', 5, 7), ('7-8.9', 7, 9), ('9+', 9, 11)) as t(tramo, lo, hi)
    left join ap on ap.nota >= t.lo and ap.nota < t.hi
    group by t.tramo, t.lo
  )
  select jsonb_build_object(
    'n', tot.n, 'min_n', v_min, 'suficiente', true,
    'horas_por_credito_media', round(tot.hpc_m, 2),
    'minutos_medios', round(tot.min_m, 0),
    'horas_por_credito_q1', round(tot.q1::numeric, 2),
    'horas_por_credito_q3', round(tot.q3::numeric, 2),
    'horas_por_credito_iqr', round((tot.q3 - tot.q1)::numeric, 2),
    'desgaste_medio', round(tot.desg_m, 2),
    'pct_aprobado_primera', round(tot.pct1, 1),
    'cursos_necesarios_medio', round(tot.cur_m, 2),
    'tramos', (
      select jsonb_agg(jsonb_build_object(
        'tramo', tr.tramo, 'n', tr.n,
        'horas_por_credito_media', case when tr.n >= v_min then round(tr.hpc_m, 2) end,
        'pct_aprobado_primera', case when tr.n >= v_min then round(tr.pct1, 1) end,
        'cursos_necesarios_medio', case when tr.n >= v_min then round(tr.cur_m, 2) end,
        'desgaste_medio', case when tr.n >= v_min then round(tr.desg_m, 2) end
      ) order by tr.lo) from tr)
  ) into v_res
  from tot;

  return v_res;
end;
$fn$;

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

create or replace function public.detalle_aprobado(p_canonica uuid, p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_row record;
  v_notas boolean;
  v_res jsonb;
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if not coalesce((select share_ranking_ok from public.perfil_social where user_id = auth.uid()), false) then
    raise exception 'consentimiento_propio_requerido' using errcode = '42501';
  end if;

  select x.asignatura_id, x.hpc, ps.username, ps.verificado, ps.show_grades
  into v_row
  from public._aprobados(p_canonica) x
  join public.perfil_social ps on ps.user_id = x.user_id and ps.share_ranking_ok
  where lower(ps.username) = lower(trim(p_username));
  if not found then raise exception 'no_disponible' using errcode = '42501'; end if;
  v_notas := v_row.show_grades;

  select jsonb_build_object(
    'username', v_row.username,
    'verificado', v_row.verificado,
    'horas_por_credito_total', round(v_row.hpc, 2),
    'principal', (
      select jsonb_build_object(
        'nombre', c.nombre_oficial, 'creditos', a.creditos,
        'minutos', m.minutos,
        'horas_por_credito', case when a.creditos > 0 then round(m.minutos / 60.0 / a.creditos, 2) end,
        'cursos_necesarios', a.frozen_cursos_necesarios,
        'desgaste_maximo', public._desgaste_indice(a.id),
        'nota', case when v_notas then a.frozen_nota end
      )
      from public.asignaturas a
      join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
      cross join lateral (
        select coalesce(sum(e.minutos), 0)::numeric as minutos from public.entradas_estudio e where e.asignatura_id = a.id
      ) m
      where a.id = v_row.asignatura_id
    ),
    'equivalentes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', x.nombre, 'creditos', x.creditos, 'es_erasmus', x.es_erasmus,
        'minutos', m.minutos,
        'horas_por_credito', case when x.creditos > 0 then round(m.minutos / 60.0 / x.creditos, 2) end,
        'cursos_necesarios', x.frozen_cursos_necesarios,
        'desgaste_maximo', public._desgaste_indice(x.id),
        'nota', case when v_notas then x.frozen_nota end
      ) order by x.created_at, x.id)
      from public.asignaturas x
      cross join lateral (
        select coalesce(sum(e.minutos), 0)::numeric as minutos from public.entradas_estudio e where e.asignatura_id = x.id
      ) m
      where x.asignatura_equivalente_id = v_row.asignatura_id and x.estado = 'aprobada' and x.es_erasmus is true
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$fn$;


drop function if exists public._desgaste_grupo(uuid);
drop function if exists public._desgaste_miembros(uuid[]);
drop function if exists public._grupos_aprobados(uuid);
drop function if exists public._cursos_miembros(uuid, uuid[]);
drop function if exists public._grupo_miembros(uuid);
drop function if exists public._grupos_usuario(uuid);
