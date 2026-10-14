-- ============================================================
-- Migración 035: aviso «hemos ajustado las fechas de tus cursos».
--   * Añade profiles.aviso_cursos_pendiente (por defecto false). La app lo lee al entrar y, si es
--     true, muestra una ventana explicando que se han corregido las fechas de sus cursos y cómo
--     debe usarse (un curso = un año académico). Al cerrarla, la propia app lo pone en false.
--   * Lo activa solo para los 7 usuarios cuyos cursos se corrigieron a mano.
-- No borra ni modifica datos de estudio. Rollback: alter table public.profiles drop column aviso_cursos_pendiente;
-- Ejecutar en el SQL Editor de Supabase (Run).
-- ============================================================

alter table public.profiles add column if not exists aviso_cursos_pendiente boolean not null default false;

update public.profiles set aviso_cursos_pendiente = true
where id in (
  '0f387443-a837-4948-9ac0-6344ed3be2a8',
  '14529607-f30e-4573-9fe2-ca4af063a000',
  '2879fc00-dc98-43b8-8d71-03cdb76f4d57',
  '55679f50-8985-4e69-9f13-f7595f770d66',
  '58051e3e-168a-4c4b-a012-12897e579b3f',
  '6ae06f03-17b4-4eda-a643-9bc25e2f34df',
  'bbe105d9-6282-45ab-a65f-87705ea57deb'
);
