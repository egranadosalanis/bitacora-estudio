-- ============================================================
-- Migración 030: Social — clasificación general (todos los usuarios).
--
-- * perfil_social: nuevo consentimiento aparte, share_global_ok (aparecer y ver la clasificación
--   general de todos los usuarios, semanal y de season). Es independiente del de amigos y del
--   del listado de aprobados, porque la audiencia es distinta.
-- * establecer_consentimiento: admite el tipo 'global'.
-- * clasificacion_global(inicio, fin, limite): ranking por minutos estudiados en el periodo entre
--   los usuarios que han aceptado. Solo lo puede pedir quien también ha aceptado. Devuelve el top
--   y la fila propia (con su posición real) aunque quede fuera del top. Solo cuentan las horas de
--   asignaturas con créditos, igual que los puntos de rango. No se muestran usuarios bloqueados.
--
-- No toca datos existentes. Rollback: rollback/030_volver_a_sin_clasificacion_global.sql
-- Ejecutar en el SQL Editor de Supabase (Run).
-- ============================================================

alter table public.perfil_social
  add column if not exists share_global_ok boolean not null default false,
  add column if not exists share_global_at timestamptz,
  add column if not exists share_global_version text;

alter table public.perfil_social drop constraint if exists perfil_social_global_consta;
alter table public.perfil_social add constraint perfil_social_global_consta
  check (not share_global_ok or (share_global_at is not null and share_global_version is not null));

create index if not exists idx_entradas_fecha on public.entradas_estudio(fecha);

-- p_tipo: 'metricas' (amigos), 'ranking' (listado de aprobados) o 'global' (clasificación general).
create or replace function public.establecer_consentimiento(p_tipo text, p_acepta boolean, p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if p_tipo not in ('metricas', 'ranking', 'global') then raise exception 'tipo_invalido' using errcode = '22023'; end if;
  if p_acepta and coalesce(trim(p_version), '') = '' then raise exception 'version_requerida' using errcode = '22023'; end if;

  if p_tipo = 'metricas' then
    update public.perfil_social set
      share_metrics_ok = p_acepta,
      share_metrics_at = case when p_acepta then now() else share_metrics_at end,
      share_metrics_version = case when p_acepta then trim(p_version) else share_metrics_version end,
      updated_at = now()
    where user_id = v_me;
  elsif p_tipo = 'ranking' then
    update public.perfil_social set
      share_ranking_ok = p_acepta,
      share_ranking_at = case when p_acepta then now() else share_ranking_at end,
      share_ranking_version = case when p_acepta then trim(p_version) else share_ranking_version end,
      updated_at = now()
    where user_id = v_me;
  else
    update public.perfil_social set
      share_global_ok = p_acepta,
      share_global_at = case when p_acepta then now() else share_global_at end,
      share_global_version = case when p_acepta then trim(p_version) else share_global_version end,
      updated_at = now()
    where user_id = v_me;
  end if;
  if not found then raise exception 'sin_perfil_social' using errcode = 'P0002'; end if;
end;
$fn$;

create or replace function public.clasificacion_global(p_inicio date, p_fin date, p_limite int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_lim int := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_res jsonb;
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if p_inicio is null or p_fin is null or p_fin < p_inicio or p_fin - p_inicio > 200 then
    raise exception 'rango_invalido' using errcode = '22023';
  end if;
  if not coalesce((select share_global_ok from public.perfil_social where user_id = v_me), false) then
    raise exception 'consentimiento_global_requerido' using errcode = '42501';
  end if;

  with agg as (
    select e.user_id, sum(e.minutos)::int as minutos, count(distinct e.fecha)::int as dias
    from public.entradas_estudio e
    join public.asignaturas a on a.id = e.asignatura_id
    left join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
    join public.perfil_social ps on ps.user_id = e.user_id and ps.share_global_ok
    where e.fecha between p_inicio and p_fin
      and coalesce(c.no_credits, false) = false
      and (
        e.user_id = v_me
        or not exists (
          select 1 from public.amistades b
          where b.estado = 'bloqueada'
            and least(b.solicitante, b.receptor) = least(v_me, e.user_id)
            and greatest(b.solicitante, b.receptor) = greatest(v_me, e.user_id)
        )
      )
    group by e.user_id
    having sum(e.minutos) > 0
  ),
  ranked as (
    select agg.user_id, agg.minutos, agg.dias, ps.username, ps.verificado,
           case when ps.show_avatar then ps.avatar_url end as avatar_url,
           case when ps.show_avatar then ps.avatar_path end as avatar_path,
           row_number() over (order by agg.minutos desc, lower(ps.username)) as pos
    from agg join public.perfil_social ps on ps.user_id = agg.user_id
  )
  select jsonb_build_object(
    'total', (select count(*) from ranked),
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pos', r.pos, 'username', r.username, 'verificado', r.verificado,
        'avatar_url', r.avatar_url, 'avatar_path', r.avatar_path,
        'minutos', r.minutos, 'dias', r.dias, 'yo', r.user_id = v_me
      ) order by r.pos) from ranked r where r.pos <= v_lim), '[]'::jsonb),
    'yo', (
      select jsonb_build_object(
        'pos', r.pos, 'username', r.username, 'verificado', r.verificado,
        'avatar_url', r.avatar_url, 'avatar_path', r.avatar_path,
        'minutos', r.minutos, 'dias', r.dias, 'yo', true
      ) from ranked r where r.user_id = v_me)
  ) into v_res;

  return v_res;
end;
$fn$;

revoke execute on function public.clasificacion_global(date, date, int) from public, anon, authenticated;
grant execute on function public.clasificacion_global(date, date, int) to authenticated;
