-- ============================================================
-- 013: marcas de asignatura canónica "es Erasmus" y "no tiene créditos".
-- Las pone SOLO el admin (service_role). Los usuarios normales no
-- tienen policy de update sobre asignaturas_canonicas, así que no
-- pueden cambiarlas. Se leen siempre en directo, no se copian al
-- usuario: marcar una canónica afecta a todos los que la tienen
-- vinculada sin migrar nada.
-- Vuelta atrás: supabase/rollback/013_volver_a_sin_marcas.sql
-- ============================================================

alter table public.asignaturas_canonicas
  add column if not exists is_erasmus boolean not null default false,
  add column if not exists no_credits boolean not null default false;
