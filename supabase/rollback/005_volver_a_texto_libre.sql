-- ============================================================
-- VUELTA ATRÁS de la migración 005 — ejecutar SOLO si se decide
-- volver a que universidad/carrera/asignatura sean solo texto libre.
--
-- Quita las columnas de enlace, las funciones y las tablas nuevas.
-- NO TOCA los datos existentes: `profiles.universidad`/`carrera` y
-- `asignaturas.nombre` (texto libre) se quedan exactamente igual —
-- solo se pierde el enlace a la fila canónica, no el texto en sí.
--
-- Las extensiones pg_trgm/unaccent se dejan instaladas a propósito
-- (podría depender de ellas alguna otra cosa); si de verdad hace
-- falta quitarlas, hazlo aparte con
-- "drop extension if exists pg_trgm; drop extension if exists unaccent;"
-- ============================================================

alter table public.asignaturas
  drop column if exists asignatura_canonica_id,
  drop column if exists es_erasmus;

alter table public.profiles
  drop column if exists universidad_canonica_id,
  drop column if exists carrera_canonica_id;

drop function if exists public.fusionar_normalizacion(text, uuid, uuid);
drop function if exists public.crear_asignatura_pendiente(uuid, text, numeric);
drop function if exists public.crear_carrera_pendiente(uuid, text);
drop function if exists public.crear_universidad_pendiente(text, text);
drop function if exists public.buscar_asignaturas_canonicas(uuid, text, int);
drop function if exists public.buscar_carreras(uuid, text, int);
drop function if exists public.buscar_universidades(text, int);

drop table if exists public.asignaturas_alias;
drop table if exists public.carreras_alias;
drop table if exists public.universidades_alias;
drop table if exists public.asignaturas_canonicas;
drop table if exists public.carreras_canonicas;
drop table if exists public.universidades_canonicas;

drop function if exists public.normalizar_texto(text);
