-- Rollback de 032: vuelve a mis_amistades() sin `estudiando` y quita la columna y la función.
drop function if exists public.mis_amistades();
create function public.mis_amistades()
returns table (id uuid, username text, verificado boolean, avatar_url text, avatar_path text, estado text, direccion text)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.id, ps.username, ps.verificado,
         case when ps.show_avatar and ps.share_metrics_ok then ps.avatar_url end,
         case when ps.show_avatar and ps.share_metrics_ok then ps.avatar_path end,
         a.estado,
         case when a.solicitante = auth.uid() then 'enviada' else 'recibida' end
  from public.amistades a
  join public.perfil_social ps
    on ps.user_id = case when a.solicitante = auth.uid() then a.receptor else a.solicitante end
  where auth.uid() in (a.solicitante, a.receptor)
    and (a.estado in ('pendiente', 'aceptada') or (a.estado = 'bloqueada' and a.bloqueado_por = auth.uid()))
  order by a.estado, ps.username
$fn$;
revoke execute on function public.mis_amistades() from public, anon, authenticated;
grant execute on function public.mis_amistades() to authenticated;

drop function if exists public.latido_estudio(boolean);
alter table public.perfil_social drop column if exists estudiando_hasta;
