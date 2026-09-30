-- Migración 022: aviso de Advisors "function_search_path_mutable" en social_min_n.
-- No toca datos. Idempotente.
alter function public.social_min_n() set search_path = public;

-- Aviso informativo "rls_enabled_no_policy" en social_reservados: la tabla es solo
-- para el servidor, así que se deja una política explícita que no permite leer nada.
drop policy if exists "social_reservados_nadie" on public.social_reservados;
create policy "social_reservados_nadie" on public.social_reservados
  for select to authenticated using (false);
