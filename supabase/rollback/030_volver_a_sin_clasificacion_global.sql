-- Deshace 030: quita la clasificación general y su consentimiento.
drop function if exists public.clasificacion_global(date, date, int);
drop index if exists public.idx_entradas_fecha;

-- Vuelve a la versión anterior (sin el tipo 'global').
create or replace function public.establecer_consentimiento(p_tipo text, p_acepta boolean, p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if p_tipo not in ('metricas', 'ranking') then raise exception 'tipo_invalido' using errcode = '22023'; end if;
  if p_acepta and coalesce(trim(p_version), '') = '' then raise exception 'version_requerida' using errcode = '22023'; end if;

  if p_tipo = 'metricas' then
    update public.perfil_social set
      share_metrics_ok = p_acepta,
      share_metrics_at = case when p_acepta then now() else share_metrics_at end,
      share_metrics_version = case when p_acepta then trim(p_version) else share_metrics_version end,
      updated_at = now()
    where user_id = v_me;
  else
    update public.perfil_social set
      share_ranking_ok = p_acepta,
      share_ranking_at = case when p_acepta then now() else share_ranking_at end,
      share_ranking_version = case when p_acepta then trim(p_version) else share_ranking_version end,
      updated_at = now()
    where user_id = v_me;
  end if;
  if not found then raise exception 'sin_perfil_social' using errcode = 'P0002'; end if;
end;
$fn$;

alter table public.perfil_social drop constraint if exists perfil_social_global_consta;
alter table public.perfil_social
  drop column if exists share_global_ok,
  drop column if exists share_global_at,
  drop column if exists share_global_version;
