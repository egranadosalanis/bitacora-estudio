-- ============================================================
-- Migración: añade universidad y carrera al perfil.
-- Ejecutar UNA VEZ en el SQL Editor de Supabase sobre un proyecto
-- que ya tenga el esquema de schema.sql aplicado. Es idempotente
-- (usa IF NOT EXISTS), así que no pasa nada si se ejecuta más de
-- una vez por error.
-- ============================================================

alter table public.profiles
  add column if not exists universidad text,
  add column if not exists carrera text;
