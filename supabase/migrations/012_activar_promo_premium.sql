-- ============================================================
-- Migración: interruptor de la promo "premium por unirte este curso".
--
-- Reutiliza app_settings (la misma tabla del modo mantenimiento).
-- Empieza APAGADO ('enabled': false) a propósito: así se puede
-- desplegar la Edge Function `grant-premium` con tranquilidad — no
-- concede premium ni manda correos a nadie hasta que el dueño lo
-- active a mano, ya revisado el correo con el modo preview.
--
-- Para activarlo cuando estés list@, ejecuta en el SQL Editor:
--
--   update public.app_settings
--   set value = jsonb_build_object('enabled', true), updated_at = now()
--   where key = 'premium_promo_enabled';
--
-- Y para volver a apagarlo (p. ej. si algo va mal):
--
--   update public.app_settings
--   set value = jsonb_build_object('enabled', false), updated_at = now()
--   where key = 'premium_promo_enabled';
--
-- ES SOLO ADITIVA e IDEMPOTENTE (`on conflict do nothing`).
-- Ejecutar en el SQL Editor de Supabase (Run).
-- ============================================================

insert into public.app_settings (key, value)
values ('premium_promo_enabled', jsonb_build_object('enabled', false))
on conflict (key) do nothing;
