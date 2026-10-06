-- ============================================================
-- Migración 032: etiqueta "LIVE" — saber qué amigos tienen el contador de estudio en marcha.
--   * perfil_social.estudiando_hasta: hasta cuándo se considera que la persona está estudiando.
--   * latido_estudio(p_activo): la app la llama cada minuto mientras el contador corre
--     (p_activo = true  -> estudiando_hasta = ahora + 3 min; p_activo = false -> se borra).
--     Si la app se cierra o pierde conexión, la marca caduca sola a los 3 minutos.
--     No hace nada (sin error) si la persona no tiene perfil social o no comparte sus métricas.
--   * mis_amistades(): devuelve además `estudiando` (true solo para amistades aceptadas que
--     comparten métricas y tienen la marca vigente).
-- Es aditiva: una columna nueva (nullable) y una función nueva; mis_amistades se recrea con
-- una columna más. Rollback: supabase/rollback/032_volver_a_sin_live.sql
-- ============================================================

alter table public.perfil_social add column if not exists estudiando_hasta timestamptz;

create or replace function public.latido_estudio(p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  update public.perfil_social
  set estudiando_hasta = case when p_activo then now() + interval '3 minutes' else null end
  where user_id = auth.uid() and share_metrics_ok;
end;
$fn$;

drop function if exists public.mis_amistades();
create function public.mis_amistades()
returns table (id uuid, username text, verificado boolean, avatar_url text, avatar_path text, estado text, direccion text, estudiando boolean)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.id, ps.username, ps.verificado,
         case when ps.show_avatar and ps.share_metrics_ok then ps.avatar_url end,
         case when ps.show_avatar and ps.share_metrics_ok then ps.avatar_path end,
         a.estado,
         case when a.solicitante = auth.uid() then 'enviada' else 'recibida' end,
         (a.estado = 'aceptada' and ps.share_metrics_ok and coalesce(ps.estudiando_hasta > now(), false))
  from public.amistades a
  join public.perfil_social ps
    on ps.user_id = case when a.solicitante = auth.uid() then a.receptor else a.solicitante end
  where auth.uid() in (a.solicitante, a.receptor)
    and (a.estado in ('pendiente', 'aceptada') or (a.estado = 'bloqueada' and a.bloqueado_por = auth.uid()))
  order by a.estado, ps.username
$fn$;

do $fn$
declare f text;
begin
  foreach f in array array['latido_estudio(boolean)', 'mis_amistades()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$fn$;
