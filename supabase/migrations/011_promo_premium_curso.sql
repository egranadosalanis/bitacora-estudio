-- ============================================================
-- Migración: promoción "premium por unirte este curso".
--
-- Añade una marca de cuándo se concedió el premium por la promoción
-- (distinta de un futuro premium de pago real), para no reenviar el
-- correo de bienvenida dos veces y para poder identificar/revertir
-- estas cuentas más adelante si hace falta. NULL = nunca se le
-- concedió por esta promo.
--
-- La concesión en sí (poner plan = 'premium_historico' + mandar el
-- correo) la hace la Edge Function `grant-premium`, con la
-- service_role key — esta migración solo añade la columna.
--
-- ES SOLO ADITIVA e IDEMPOTENTE (`add column if not exists`).
-- Ejecutar en el SQL Editor de Supabase (Run).
-- ============================================================

alter table public.profiles
  add column if not exists premium_promo_granted_at timestamptz;
