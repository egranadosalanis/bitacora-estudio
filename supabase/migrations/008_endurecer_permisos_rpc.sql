-- ============================================================
-- Corrección de seguridad: 005_normalizacion_canonica.sql revocaba el
-- EXECUTE de las funciones nuevas solo al pseudo-rol "public", pero
-- Supabase concede EXECUTE a "anon" y "authenticated" de forma
-- automática al crear cualquier función en el esquema public (para
-- que PostgREST pueda exponerla vía RPC) — ese permiso automático NO
-- se quita revocando de "public", hay que revocárselo a cada rol por
-- su nombre.
--
-- Efecto real de esto sin corregir: cualquiera con la clave anon
-- (la que va en el navegador) podía llamar a fusionar_normalizacion
-- sin haber iniciado sesión, y repuntar o fusionar universidades,
-- carreras o asignaturas de cualquier usuario.
--
-- Este archivo solo ajusta permisos (revoke/grant) — no toca tablas
-- ni datos. Es seguro ejecutarlo aunque ya se hayan ejecutado
-- 005/006/007. Es idempotente: revocar/conceder algo que ya está
-- revocado/concedido no da error.
-- ============================================================

revoke execute on function public.normalizar_texto(text) from public, anon, authenticated;
grant execute on function public.normalizar_texto(text) to authenticated, service_role;

revoke execute on function public.buscar_universidades(text, int) from public, anon, authenticated;
revoke execute on function public.buscar_carreras(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.buscar_asignaturas_canonicas(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.crear_universidad_pendiente(text, text) from public, anon, authenticated;
revoke execute on function public.crear_carrera_pendiente(uuid, text) from public, anon, authenticated;
revoke execute on function public.crear_asignatura_pendiente(uuid, text, numeric) from public, anon, authenticated;
revoke execute on function public.fusionar_normalizacion(text, uuid, uuid) from public, anon, authenticated, service_role;

grant execute on function public.buscar_universidades(text, int) to authenticated;
grant execute on function public.buscar_carreras(uuid, text, int) to authenticated;
grant execute on function public.buscar_asignaturas_canonicas(uuid, text, int) to authenticated;
grant execute on function public.crear_universidad_pendiente(text, text) to authenticated;
grant execute on function public.crear_carrera_pendiente(uuid, text) to authenticated;
grant execute on function public.crear_asignatura_pendiente(uuid, text, numeric) to authenticated;

grant execute on function public.fusionar_normalizacion(text, uuid, uuid) to service_role;
