-- ============================================================
-- Verificación de la migración 004 (solo LECTURA: no cambia nada).
-- Ejecutar en el SQL Editor de Supabase después de 004_entradas_estudio.sql.
-- Cada consulta se puede ejecutar por separado (selecciónala y Run).
--
-- Compara registros_estudio (lo de antes) con las entradas migradas
-- (legacy_registro_id no nulo). Las entradas nuevas creadas con la app
-- nueva no cuentan aquí, porque no existen en la tabla vieja.
-- ============================================================

-- 1) Totales globales: las dos filas deben tener mismas "filas" y "minutos".
select 'antes (registros_estudio)' as origen, count(*) as filas, coalesce(sum(minutos), 0) as minutos
from public.registros_estudio
union all
select 'después (entradas migradas)', count(*), coalesce(sum(minutos), 0)
from public.entradas_estudio
where legacy_registro_id is not null;

-- 2) Totales por usuario y asignatura, antes y después, lado a lado.
--    La columna "cuadra" debe ser true en TODAS las filas.
select
  coalesce(a.user_id, d.user_id) as user_id,
  coalesce(a.asignatura_id, d.asignatura_id) as asignatura_id,
  s.nombre as asignatura,
  a.minutos as minutos_antes,
  d.minutos as minutos_despues,
  a.minutos is not distinct from d.minutos as cuadra
from (
  select user_id, asignatura_id, sum(minutos) as minutos
  from public.registros_estudio group by 1, 2
) a
full outer join (
  select user_id, asignatura_id, sum(minutos) as minutos
  from public.entradas_estudio where legacy_registro_id is not null group by 1, 2
) d on d.user_id = a.user_id and d.asignatura_id = a.asignatura_id
left join public.asignaturas s on s.id = coalesce(a.asignatura_id, d.asignatura_id)
order by cuadra, user_id, asignatura;

-- 3) Diferencias fila a fila. Debe devolver 0 filas.
--    Si devuelve algo, es que una fila antigua se editó o borró con la app
--    vieja DESPUÉS de migrar (o que la copia falló). No lo arregles a mano:
--    avisa y lo miramos.
select 'fila antigua sin copiar' as problema, r.id, r.user_id, r.asignatura_id, r.fecha, r.minutos as minutos_antes, null::integer as minutos_despues
from public.registros_estudio r
left join public.entradas_estudio e on e.legacy_registro_id = r.id
where e.id is null
union all
select 'minutos distintos', r.id, r.user_id, r.asignatura_id, r.fecha, r.minutos, e.minutos
from public.registros_estudio r
join public.entradas_estudio e on e.legacy_registro_id = r.id
where e.minutos <> r.minutos or e.fecha <> r.fecha or e.asignatura_id <> r.asignatura_id or e.user_id <> r.user_id
union all
select 'copia cuyo original ya no existe', e.legacy_registro_id, e.user_id, e.asignatura_id, e.fecha, null, e.minutos
from public.entradas_estudio e
left join public.registros_estudio r on r.id = e.legacy_registro_id
where e.legacy_registro_id is not null and r.id is null;

-- 4) Comprobación de seguridad: RLS activado en la tabla nueva y su política.
select relname as tabla, relrowsecurity as rls_activado
from pg_class where relname = 'entradas_estudio';
select policyname, cmd, qual, with_check
from pg_policies where tablename = 'entradas_estudio';
