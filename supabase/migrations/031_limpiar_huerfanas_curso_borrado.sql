-- ============================================================
-- Migración 031: limpia las asignaturas "huérfanas" que dejó el borrado de cursos.
--   Antes de este cambio, borrar un curso solo borraba la fila del curso: sus entradas de
--   estudio y sus asignaturas se quedaban (origin_curso_id es `on delete set null`), y
--   aparecían como intentos combinados con la asignatura anterior, imposibles de borrar.
--   Una asignatura es huérfana si:
--     * tiene entradas y NINGUNA cae dentro del rango de fechas de algún curso del usuario; o
--     * no tiene ninguna entrada y su origin_curso_id es null.
--   Se borran esas asignaturas (sus entradas se van en cascada) y las combinaciones que
--   apuntaban a ellas quedan sueltas (asignatura_equivalente_id es `on delete set null`).
--   Guarda copias en asignaturas_backup_031 y entradas_estudio_backup_031 antes de borrar.
--   Es idempotente: si ya no queda ninguna huérfana, no hace nada.
-- Ejecutar en el SQL Editor de Supabase. Para ver antes qué se borraría, ejecuta solo la
-- consulta de vista previa que va justo debajo.
-- ============================================================

-- ---------- VISTA PREVIA (no modifica nada) ----------
-- select a.id, p.email, a.nombre, a.estado, a.created_at,
--        (select count(*) from public.entradas_estudio e where e.asignatura_id = a.id) as entradas,
--        (select coalesce(sum(minutos), 0) from public.entradas_estudio e where e.asignatura_id = a.id) as minutos
-- from public.asignaturas a
-- join public.profiles p on p.id = a.user_id
-- where (
--   exists (select 1 from public.entradas_estudio e where e.asignatura_id = a.id)
--   and not exists (
--     select 1 from public.entradas_estudio e
--     join public.cursos c on c.user_id = a.user_id and e.fecha between c.start_date and c.end_date
--     where e.asignatura_id = a.id
--   )
-- ) or (
--   not exists (select 1 from public.entradas_estudio e where e.asignatura_id = a.id)
--   and a.origin_curso_id is null
-- )
-- order by p.email, a.nombre;

create table if not exists public.asignaturas_backup_031 as select * from public.asignaturas;
create table if not exists public.entradas_estudio_backup_031 as select * from public.entradas_estudio;

delete from public.asignaturas a
where (
  exists (select 1 from public.entradas_estudio e where e.asignatura_id = a.id)
  and not exists (
    select 1 from public.entradas_estudio e
    join public.cursos c on c.user_id = a.user_id and e.fecha between c.start_date and c.end_date
    where e.asignatura_id = a.id
  )
) or (
  not exists (select 1 from public.entradas_estudio e where e.asignatura_id = a.id)
  and a.origin_curso_id is null
);
