-- Deshace 021: quita el índice. Para volver a la búsqueda sin exigir consentimiento,
-- hay que volver a ejecutar las definiciones de buscar_usuarios/mis_amistades (020) y solicitar_amistad (015).
drop index if exists public.idx_entradas_asignatura_fecha;
drop index if exists public.idx_asignaturas_equivalente;
drop function if exists public.mi_resumen();
