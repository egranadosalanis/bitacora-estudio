-- ============================================================
-- Migración 036: un curso es un año académico y los cursos de una persona no se solapan.
--   Mismas reglas que la validación de la app (validateCursoDates en src/domain.js), para que
--   tampoco las salte una versión antigua de la app o una petición directa:
--     * el fin es posterior al inicio y de un año posterior;
--     * empieza entre agosto y octubre y termina entre mayo y septiembre;
--     * dura como máximo 13 meses (con 3 días de margen para meses de distinta longitud);
--     * los cursos de un mismo usuario no se solapan (el día de fin cuenta como ocupado).
--   Todos los cursos actuales las cumplen (comprobado antes de escribir esta migración); si alguno
--   no las cumpliera, el ALTER fallará sin cambiar nada y habrá que corregirlo primero.
--   No toca datos. Rollback: rollback/036_volver_a_cursos_libres.sql
-- Ejecutar en el SQL Editor de Supabase (Run).
-- ============================================================

create extension if not exists btree_gist;

alter table public.cursos
  add constraint cursos_ano_academico check (
    end_date > start_date
    and extract(year from end_date) > extract(year from start_date)
    and extract(month from start_date) between 8 and 10
    and extract(month from end_date) between 5 and 9
    and end_date <= start_date + interval '13 months 3 days'
  );

alter table public.cursos
  add constraint cursos_sin_solape exclude using gist (
    user_id with =,
    daterange(start_date, end_date, '[]') with &&
  );

-- ---------- VERIFICACIÓN (solo lectura) ----------
-- select conname from pg_constraint where conrelid = 'public.cursos'::regclass and conname in ('cursos_ano_academico', 'cursos_sin_solape');
