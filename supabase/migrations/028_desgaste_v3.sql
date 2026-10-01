-- ============================================================
-- Migración 028: desgaste fórmula v3 (réplica exacta de computeDesgaste de domain.js).
--   * Factores: volumen (horas totales del tramo, tope 90 h), intensidad (min/día, tope 300),
--     compresión (tope 0,9) y racha interna (tope 10). Pesos 50 % / 25 % / 12,5 % / 12,5 %.
--   * Bloque peor: el de puntuación más alta entre los de 3+ días activos (antes, el de mayor
--     intensidad). Bloques: descansos de hasta 2 días no rompen el tramo.
--   Cambia el desgaste que ven las estadísticas de Social; no toca datos.
-- Rollback: rollback/028_volver_a_desgaste_v2.sql
-- ============================================================

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
    select blk.bloque, blk.dias, blk.f0, blk.mins / 60.0 as horas, blk.mins / blk.dias as intensidad,
           blk.dias::numeric / ((blk.f1 - blk.f0) + 1) as compresion, racha.racha_interna
    from blk join racha using (bloque) where blk.dias >= 3
  )
  select round((0.50 * least(horas / 90.0, 1) + 0.25 * least(intensidad / 300, 1)
              + 0.125 * least(compresion / 0.9, 1) + 0.125 * least(racha_interna / 10.0, 1)) * 10, 2)
  from cand
  order by (0.50 * least(horas / 90.0, 1) + 0.25 * least(intensidad / 300, 1)
          + 0.125 * least(compresion / 0.9, 1) + 0.125 * least(racha_interna / 10.0, 1)) desc, f0 asc
  limit 1
$fn$;
