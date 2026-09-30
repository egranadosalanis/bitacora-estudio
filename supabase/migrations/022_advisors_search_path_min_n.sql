-- Migración 022: aviso de Advisors "function_search_path_mutable" en social_min_n.
-- No toca datos. Idempotente.
alter function public.social_min_n() set search_path = public;
