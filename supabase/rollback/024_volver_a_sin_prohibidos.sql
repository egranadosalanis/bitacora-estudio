-- Deshace 024: quita la lista de nombres prohibidos y deja _username_reservado
-- como en 019 (solo nombres reservados).
create or replace function public._username_reservado(p_username text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.social_reservados r
    where position(public._username_normalizado(r.nombre) in public._username_normalizado(p_username)) > 0
      and r.user_id is distinct from p_user
  )
$fn$;
revoke execute on function public._username_reservado(text, uuid) from public, anon, authenticated;
drop table if exists public.social_prohibidos;
