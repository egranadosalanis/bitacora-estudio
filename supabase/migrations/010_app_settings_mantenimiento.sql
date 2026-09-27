-- ============================================================
-- Migración: modo mantenimiento.
--
-- Tabla de configuración global de la app (una fila por clave) para
-- poder "suspender" la app principal desde el panel de admin mientras
-- se trabaja en actualizaciones, sin tener que tocar código ni
-- redesplegar. La app principal lee esta tabla con la clave `anon`
-- (lectura abierta a cualquiera, autenticado o no, porque hay que
-- poder bloquear el acceso ANTES de que exista una sesión). Solo el
-- panel de admin (con la `service_role` key, que salta RLS) puede
-- escribirla.
--
-- ES SOLO ADITIVA: crea una tabla nueva y no toca ninguna otra.
-- ES IDEMPOTENTE: `create table if not exists` + `on conflict do
-- nothing` en el seed.
--
-- Ejecutar en el SQL Editor de Supabase (Run).
-- ============================================================

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('maintenance_mode', jsonb_build_object('enabled', false, 'message', ''))
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

-- Lectura abierta a todo el mundo (anon incluido): la app principal
-- necesita saber si está en mantenimiento antes de que haya sesión.
-- Sin política de insert/update/delete: solo el service_role (que
-- salta RLS) puede escribir, es decir, solo desde el panel de admin.
drop policy if exists "app_settings_select_all" on public.app_settings;
create policy "app_settings_select_all" on public.app_settings
  for select to anon, authenticated using (true);
