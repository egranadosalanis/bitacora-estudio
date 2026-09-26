-- ============================================================
-- VUELTA ATRÁS de la migración 006 — quita solo las filas sembradas
-- (origen = 'seed'), no las que hayan creado los usuarios de verdad
-- vinculándose o dando de alta algo pendiente.
--
-- Solo tiene sentido ejecutarlo ANTES de la vuelta atrás de 005 (que
-- borra las tablas enteras y ya se lleva esto por delante). Si algún
-- usuario ya se vinculó a una de estas filas sembradas, esa fila no
-- se puede borrar por la FK (asignaturas.asignatura_canonica_id) —
-- revisa antes con un select si hace falta desvincularlas primero.
-- ============================================================

delete from public.asignaturas_canonicas where origen = 'seed';
delete from public.carreras_canonicas where origen = 'seed';
delete from public.universidades_canonicas where origen = 'seed';
