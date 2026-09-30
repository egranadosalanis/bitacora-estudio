-- Deshace 020. Después hay que volver a ejecutar las definiciones de 019 de
-- mis_amistades, buscar_usuarios y resumen_amigo (sin avatar_url).
drop function if exists public.establecer_avatar(text);
drop function if exists public.establecer_foto(text);
drop function if exists public.establecer_mostrar_foto(boolean);
drop function if exists public.mis_amistades();
drop function if exists public.buscar_usuarios(text);
alter table public.perfil_social drop constraint if exists perfil_social_avatar_formato;
alter table public.perfil_social drop constraint if exists perfil_social_avatar_path_formato;
alter table public.perfil_social drop column if exists avatar_path;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;
alter table public.perfil_social drop column if exists avatar_url;
alter table public.perfil_social drop column if exists show_avatar;
