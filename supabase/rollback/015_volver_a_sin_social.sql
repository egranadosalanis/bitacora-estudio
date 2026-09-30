-- Deshace 015 (BORRA las tablas perfil_social y amistades y sus datos).
drop function if exists public.crear_perfil_social(text);
drop function if exists public.cambiar_username(text);
drop function if exists public.establecer_consentimiento(text, boolean, text);
drop function if exists public.establecer_mostrar_notas(boolean);
drop function if exists public.solicitar_amistad(text);
drop function if exists public.responder_solicitud(uuid, boolean);
drop function if exists public.quitar_amistad(text);
drop function if exists public.bloquear_usuario(text);
drop function if exists public.desbloquear_usuario(text);
drop function if exists public.mis_amistades();
drop table if exists public.amistades;
drop table if exists public.perfil_social;
