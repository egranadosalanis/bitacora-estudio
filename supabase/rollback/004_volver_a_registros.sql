-- ============================================================
-- VUELTA ATRÁS de la migración 004 — ejecutar SOLO si se decide volver
-- a la versión anterior de la app (la que usa registros_estudio).
--
-- Situación: la app vieja lee y escribe registros_estudio (un total por
-- día y asignatura). Si mientras tanto se han guardado entradas nuevas
-- con la app nueva (en entradas_estudio), esas entradas no existen en la
-- tabla vieja. Este script vuelca a registros_estudio el TOTAL por día y
-- asignatura de entradas_estudio, para que la app vieja las vea.
--
-- OJO: esto SÍ modifica registros_estudio (sobrescribe los minutos de los
-- días que tengan entradas). Hacer antes una copia de seguridad de las dos
-- tablas. No borra entradas_estudio: esa tabla se queda como estaba.
-- ============================================================

insert into public.registros_estudio (user_id, asignatura_id, fecha, minutos)
select user_id, asignatura_id, fecha, sum(minutos)::integer
from public.entradas_estudio
group by user_id, asignatura_id, fecha
on conflict (asignatura_id, fecha) do update set minutos = excluded.minutos;

-- Los días/asignaturas que se borraron por completo con la app nueva
-- siguen en registros_estudio. Para quitarlos también, revisa primero qué
-- filas saldrían con esta consulta (solo lectura):
--
-- select r.* from public.registros_estudio r
-- where not exists (
--   select 1 from public.entradas_estudio e
--   where e.asignatura_id = r.asignatura_id and e.fecha = r.fecha
-- );
--
-- y, si estás de acuerdo, cambia "select r.*" por "delete" (sin el "r.*").
