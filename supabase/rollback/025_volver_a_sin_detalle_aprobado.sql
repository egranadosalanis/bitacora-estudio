-- Deshace 025: quita el detalle de un aprobado del listado de la Guía.
drop function if exists public.detalle_aprobado(uuid, text);
