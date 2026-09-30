-- Deshace 020. Después hay que volver a ejecutar las definiciones de 019 de
-- mis_amistades, buscar_usuarios y resumen_amigo (sin avatar_url).
drop function if exists public.establecer_avatar(text);
drop function if exists public.establecer_mostrar_foto(boolean);
drop function if exists public.mis_amistades();
drop function if exists public.buscar_usuarios(text);
alter table public.perfil_social drop constraint if exists perfil_social_avatar_formato;
alter table public.perfil_social drop column if exists avatar_url;
alter table public.perfil_social drop column if exists show_avatar;
