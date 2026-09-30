-- ============================================================
-- Migración 017: Social — estadísticas de la comunidad y listado de aprobados.
-- Requiere la 015. No toca datos. Rollback: rollback/017_volver_a_sin_comunidad.sql
-- ============================================================

-- Mínimo de aprobados para mostrar estadísticas. Se cambia SOLO aquí
-- (create or replace ... select 3). Con menos, la respuesta lleva solo el n.
create or replace function public.social_min_n()
returns int
language sql
stable
as $fn$ select 1 $fn$;

-- Desgaste (índice 0-10) de una asignatura: réplica exacta de computeDesgaste
-- de domain.js (fórmula v2): bloques de estudio con descansos de hasta 2 días,
-- bloque peor = mayor intensidad entre los de 3+ días activos.
-- Función interna: no se puede llamar desde la app.
create or replace function public._desgaste_indice(p_asignatura uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $fn$
  with d as (
    select fecha, sum(minutos)::numeric as m
    from public.entradas_estudio where asignatura_id = p_asignatura
    group by fecha having sum(minutos) > 0
  ), g as (
    select fecha, m, fecha - lag(fecha) over (order by fecha) as gap from d
  ), b as (
    select fecha, m, gap,
           count(*) filter (where gap is null or gap - 1 > 2) over (order by fecha) as bloque
    from g
  ), r as (
    select fecha, m, bloque,
           count(*) filter (where gap is distinct from 1) over (partition by bloque order by fecha) as tramo
    from b
  ), racha as (
    select bloque, max(len) as racha_interna
    from (select bloque, tramo, count(*) as len from r group by bloque, tramo) t
    group by bloque
  ), blk as (
    select bloque, count(*) as dias, min(fecha) as f0, max(fecha) as f1, sum(m) as mins from r group by bloque
  ), cand as (
    select blk.bloque, blk.dias, blk.f0, blk.mins / blk.dias as intensidad,
           blk.dias::numeric / ((blk.f1 - blk.f0) + 1) as compresion, racha.racha_interna
    from blk join racha using (bloque) where blk.dias >= 3
  )
  select round((0.30 * least(intensidad / 300, 1) + 0.30 * least(dias / 18.0, 1)
              + 0.20 * least(compresion / 0.9, 1) + 0.20 * least(racha_interna / 10.0, 1)) * 10, 2)
  from cand order by intensidad desc, f0 asc limit 1
$fn$;

-- Asignaturas aprobadas de una canónica, una fila por usuario/asignatura.
-- Excluye Erasmus, "sin créditos", rechazadas y las sin horas. Las horas
-- cuentan también las de las fusionadas ya aprobadas (igual que la app).
-- Función interna: no se puede llamar desde la app.
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
    where e.asignatura_id = a.id
       or e.asignatura_id in (select x.id from public.asignaturas x where x.asignatura_equivalente_id = a.id and x.estado = 'aprobada')
  ) m
  where a.asignatura_canonica_id = p_canonica
    and a.estado = 'aprobada'
    and a.es_erasmus is not true
    and c.is_erasmus is not true and c.no_credits is not true and c.estado <> 'rechazada'
    and a.creditos > 0 and m.minutos > 0
$fn$;

-- Solo agregados, nunca filas sueltas. Con n < social_min_n() devuelve solo n.
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

-- Listado de aprobados: solo lo ve quien ha aceptado aparecer, y solo
-- aparecen los usuarios que también han aceptado.
create or replace function public.listado_aprobados(p_canonica uuid)
returns table (username text, horas_por_credito numeric, nota numeric, desgaste_maximo numeric, cursos_necesarios int)
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
  select ps.username, round(x.hpc, 2), x.nota, public._desgaste_indice(x.asignatura_id), x.cursos_necesarios
  from public._aprobados(p_canonica) x
  join public.perfil_social ps on ps.user_id = x.user_id and ps.share_ranking_ok
  order by x.nota desc nulls last, x.hpc, ps.username
  limit 200;
end;
$fn$;

do $fn$
declare f text;
begin
  foreach f in array array['comunidad_stats(uuid)', 'listado_aprobados(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_desgaste_indice(uuid)', '_aprobados(uuid)', 'social_min_n()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$fn$;
