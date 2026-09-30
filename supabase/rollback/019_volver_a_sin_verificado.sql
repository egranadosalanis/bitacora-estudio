-- Deshace 019: quita el sello y los nombres reservados. Después hay que volver a
-- ejecutar las definiciones de 015 (crear_perfil_social, cambiar_username, mis_amistades),
-- 016 (buscar_usuarios, resumen_amigo) y 017 (listado_aprobados) para recuperar sus versiones anteriores.
drop function if exists public.mis_amistades();
drop function if exists public.buscar_usuarios(text);
drop function if exists public.listado_aprobados(uuid);
drop function if exists public._username_reservado(text, uuid);
drop function if exists public._username_normalizado(text);
alter table public.perfil_social drop column if exists verificado;
drop table if exists public.social_reservados;
