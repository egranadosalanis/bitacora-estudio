-- ============================================================
-- Migración 018: limpieza de avisos de Advisors tras la 014.
--   * titlecase_es: search_path fijo.
--   * curso_es_mio / asignatura_es_mia: son ayudas internas de una política
--     RLS, no deben colgar de /rest/v1/rpc. Se mueven a un esquema `private`
--     (no expuesto por la API). La política sigue funcionando: apunta a la
--     función por su identidad, no por su nombre.
-- No toca datos. Idempotente. Rollback: rollback/018_volver_a_ayudas_en_public.sql
-- ============================================================

alter function public.titlecase_es(text) set search_path = public;

create schema if not exists private;
grant usage on schema private to authenticated;

do $fn$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'curso_es_mio') then
    alter function public.curso_es_mio(uuid) set schema private;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'asignatura_es_mia') then
    alter function public.asignatura_es_mia(uuid) set schema private;
  end if;
end;
$fn$;

revoke execute on function private.curso_es_mio(uuid) from public, anon;
revoke execute on function private.asignatura_es_mia(uuid) from public, anon;
grant execute on function private.curso_es_mio(uuid) to authenticated;
grant execute on function private.asignatura_es_mia(uuid) to authenticated;
