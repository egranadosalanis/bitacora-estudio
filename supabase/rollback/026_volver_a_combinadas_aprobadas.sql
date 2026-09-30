-- Deshace 026: vuelve a sumar solo las combinadas que están aprobadas (definiciones de 021 y 025).

create or replace function public._aprobados(p_canonica uuid)
returns table (user_id uuid, asignatura_id uuid, minutos numeric, hpc numeric, nota numeric, cursos_necesarios int)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.user_id, a.id, m.minutos, m.minutos / 60.0 / a.creditos, a.frozen_nota, a.frozen_cursos_necesarios
  from public.asignaturas a
  join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
  cross join lateral (
    select coalesce(sum(e.minutos), 0)::numeric as minutos
    from public.entradas_estudio e
    where e.asignatura_id in (
      select a.id
      union all
      select x.id from public.asignaturas x where x.asignatura_equivalente_id = a.id and x.estado = 'aprobada'
    )
  ) m
  where a.asignatura_canonica_id = p_canonica
    and a.estado = 'aprobada'
    and a.es_erasmus is not true
    and c.is_erasmus is not true and c.no_credits is not true and c.estado <> 'rechazada'
    and a.creditos > 0 and m.minutos > 0
$fn$;

create or replace function public.resumen_amigo(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_notas boolean;
  v_res jsonb;
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;

  if not coalesce((select share_metrics_ok from public.perfil_social where user_id = v_me), false) then
    raise exception 'consentimiento_propio_requerido' using errcode = '42501';
  end if;

  select ps.user_id, ps.show_grades into v_other, v_notas
  from public.perfil_social ps
  where lower(ps.username) = lower(trim(p_username)) and ps.share_metrics_ok
    and exists (
      select 1 from public.amistades a
      where a.estado = 'aceptada'
        and least(a.solicitante, a.receptor) = least(v_me, ps.user_id)
        and greatest(a.solicitante, a.receptor) = greatest(v_me, ps.user_id)
    );
  -- Mismo error si no existe, no sois amigos o no ha aceptado: no se revela cuál.
  if v_other is null then raise exception 'no_disponible' using errcode = '42501'; end if;

  with subj as (
    select row_number() over (order by a.created_at, a.id) as ref, a.id, a.creditos, a.estado, a.color,
           a.es_erasmus, a.frozen_nota, a.frozen_cursos_necesarios,
           coalesce(case when a.asignatura_canonica_id is not null and a.es_erasmus is not true and c.estado <> 'rechazada'
                         then c.nombre_oficial end, a.nombre) as nombre,
           (c.no_credits is true) as sin_creditos
    from public.asignaturas a
    left join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
    where a.user_id = v_other
  ),
  own as (
    select asignatura_id, sum(minutos)::bigint as minutos from public.entradas_estudio
    where user_id = v_other group by asignatura_id
  ),
  det as (
    select s.*, coalesce(o.minutos, 0) as minutos,
           -- Aprobadas: sus minutos + los de las fusionadas ya aprobadas (Erasmus...).
           case when s.estado = 'aprobada' then (
             select coalesce(sum(e.minutos), 0) from public.entradas_estudio e
             where e.asignatura_id in (
               select s.id
               union all
               select x.id from public.asignaturas x where x.asignatura_equivalente_id = s.id and x.estado = 'aprobada')
           ) end as minutos_computables
    from subj s left join own o on o.asignatura_id = s.id
  ),
  tot as (
    select coalesce(sum(minutos), 0) as minutos_totales, count(*) as n_asignaturas,
           sum(minutos_computables) filter (where estado = 'aprobada' and es_erasmus is not true and not sin_creditos and creditos > 0) as min_apr,
           sum(creditos) filter (where estado = 'aprobada' and es_erasmus is not true and not sin_creditos and creditos > 0) as cred_apr
    from det
  )
  select jsonb_build_object(
    'username', (select username from public.perfil_social where user_id = v_other),
    'verificado', (select verificado from public.perfil_social where user_id = v_other),
    'avatar_url', (select case when show_avatar then avatar_url end from public.perfil_social where user_id = v_other),
    'avatar_path', (select case when show_avatar then avatar_path end from public.perfil_social where user_id = v_other),
    'mostrar_notas', v_notas,
    'minutos_totales', tot.minutos_totales,
    'n_asignaturas', tot.n_asignaturas,
    'horas_por_credito', case when coalesce(tot.cred_apr, 0) > 0 then round(tot.min_apr / 60.0 / tot.cred_apr, 3) end,
    'asignaturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref', d.ref, 'nombre', d.nombre, 'creditos', d.creditos, 'estado', d.estado, 'color', d.color,
        'es_erasmus', d.es_erasmus, 'sin_creditos', d.sin_creditos, 'minutos', d.minutos,
        'horas_por_credito', case when d.estado = 'aprobada' and d.es_erasmus is not true and not d.sin_creditos and d.creditos > 0
                                  then round(d.minutos_computables / 60.0 / d.creditos, 3) end,
        'cursos_necesarios', case when d.estado = 'aprobada' then d.frozen_cursos_necesarios end,
        'nota', case when v_notas and d.estado = 'aprobada' then d.frozen_nota end
      ) order by d.ref) from det d), '[]'::jsonb),
    'historial', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', h.fecha, 'ref', h.ref, 'minutos', h.minutos) order by h.fecha, h.ref)
      from (
        select e.fecha, s.ref, sum(e.minutos)::int as minutos
        from public.entradas_estudio e join subj s on s.id = e.asignatura_id
        where e.user_id = v_other group by e.fecha, s.ref
      ) h), '[]'::jsonb)
  ) into v_res
  from tot;

  return v_res;
end;
$fn$;

create or replace function public.mi_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_notas boolean;
  v_res jsonb;
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  select show_grades into v_notas from public.perfil_social where user_id = v_me;
  if not found then raise exception 'sin_perfil_social' using errcode = 'P0002'; end if;

  with subj as (
    select row_number() over (order by a.created_at, a.id) as ref, a.id, a.creditos, a.estado, a.color,
           a.es_erasmus, a.frozen_nota, a.frozen_cursos_necesarios,
           coalesce(case when a.asignatura_canonica_id is not null and a.es_erasmus is not true and c.estado <> 'rechazada'
                         then c.nombre_oficial end, a.nombre) as nombre,
           (c.no_credits is true) as sin_creditos
    from public.asignaturas a
    left join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
    where a.user_id = v_me
  ),
  own as (
    select asignatura_id, sum(minutos)::bigint as minutos from public.entradas_estudio
    where user_id = v_me group by asignatura_id
  ),
  det as (
    select s.*, coalesce(o.minutos, 0) as minutos,
           -- Aprobadas: sus minutos + los de las fusionadas ya aprobadas (Erasmus...).
           case when s.estado = 'aprobada' then (
             select coalesce(sum(e.minutos), 0) from public.entradas_estudio e
             where e.asignatura_id in (
               select s.id
               union all
               select x.id from public.asignaturas x where x.asignatura_equivalente_id = s.id and x.estado = 'aprobada')
           ) end as minutos_computables
    from subj s left join own o on o.asignatura_id = s.id
  ),
  tot as (
    select coalesce(sum(minutos), 0) as minutos_totales, count(*) as n_asignaturas,
           sum(minutos_computables) filter (where estado = 'aprobada' and es_erasmus is not true and not sin_creditos and creditos > 0) as min_apr,
           sum(creditos) filter (where estado = 'aprobada' and es_erasmus is not true and not sin_creditos and creditos > 0) as cred_apr
    from det
  )
  select jsonb_build_object(
    'username', (select username from public.perfil_social where user_id = v_me),
    'verificado', (select verificado from public.perfil_social where user_id = v_me),
    'avatar_url', (select case when show_avatar then avatar_url end from public.perfil_social where user_id = v_me),
    'avatar_path', (select case when show_avatar then avatar_path end from public.perfil_social where user_id = v_me),
    'mostrar_notas', v_notas,
    'minutos_totales', tot.minutos_totales,
    'n_asignaturas', tot.n_asignaturas,
    'horas_por_credito', case when coalesce(tot.cred_apr, 0) > 0 then round(tot.min_apr / 60.0 / tot.cred_apr, 3) end,
    'asignaturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref', d.ref, 'nombre', d.nombre, 'creditos', d.creditos, 'estado', d.estado, 'color', d.color,
        'es_erasmus', d.es_erasmus, 'sin_creditos', d.sin_creditos, 'minutos', d.minutos,
        'horas_por_credito', case when d.estado = 'aprobada' and d.es_erasmus is not true and not d.sin_creditos and d.creditos > 0
                                  then round(d.minutos_computables / 60.0 / d.creditos, 3) end,
        'cursos_necesarios', case when d.estado = 'aprobada' then d.frozen_cursos_necesarios end,
        'nota', case when v_notas and d.estado = 'aprobada' then d.frozen_nota end
      ) order by d.ref) from det d), '[]'::jsonb),
    'historial', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', h.fecha, 'ref', h.ref, 'minutos', h.minutos) order by h.fecha, h.ref)
      from (
        select e.fecha, s.ref, sum(e.minutos)::int as minutos
        from public.entradas_estudio e join subj s on s.id = e.asignatura_id
        where e.user_id = v_me group by e.fecha, s.ref
      ) h), '[]'::jsonb)
  ) into v_res
  from tot;

  return v_res;
end;
$fn$;

create or replace function public.detalle_aprobado(p_canonica uuid, p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_row record;
  v_notas boolean;
  v_res jsonb;
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if not coalesce((select share_ranking_ok from public.perfil_social where user_id = auth.uid()), false) then
    raise exception 'consentimiento_propio_requerido' using errcode = '42501';
  end if;

  select x.asignatura_id, x.hpc, ps.username, ps.verificado, ps.show_grades
  into v_row
  from public._aprobados(p_canonica) x
  join public.perfil_social ps on ps.user_id = x.user_id and ps.share_ranking_ok
  where lower(ps.username) = lower(trim(p_username));
  if not found then raise exception 'no_disponible' using errcode = '42501'; end if;
  v_notas := v_row.show_grades;

  select jsonb_build_object(
    'username', v_row.username,
    'verificado', v_row.verificado,
    'horas_por_credito_total', round(v_row.hpc, 2),
    'principal', (
      select jsonb_build_object(
        'nombre', c.nombre_oficial, 'creditos', a.creditos,
        'minutos', m.minutos,
        'horas_por_credito', case when a.creditos > 0 then round(m.minutos / 60.0 / a.creditos, 2) end,
        'cursos_necesarios', a.frozen_cursos_necesarios,
        'desgaste_maximo', public._desgaste_indice(a.id),
        'nota', case when v_notas then a.frozen_nota end
      )
      from public.asignaturas a
      join public.asignaturas_canonicas c on c.id = a.asignatura_canonica_id
      cross join lateral (
        select coalesce(sum(e.minutos), 0)::numeric as minutos from public.entradas_estudio e where e.asignatura_id = a.id
      ) m
      where a.id = v_row.asignatura_id
    ),
    'equivalentes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', x.nombre, 'creditos', x.creditos, 'es_erasmus', x.es_erasmus,
        'minutos', m.minutos,
        'horas_por_credito', case when x.creditos > 0 then round(m.minutos / 60.0 / x.creditos, 2) end,
        'cursos_necesarios', x.frozen_cursos_necesarios,
        'desgaste_maximo', public._desgaste_indice(x.id),
        'nota', case when v_notas then x.frozen_nota end
      ) order by x.created_at, x.id)
      from public.asignaturas x
      cross join lateral (
        select coalesce(sum(e.minutos), 0)::numeric as minutos from public.entradas_estudio e where e.asignatura_id = x.id
      ) m
      where x.asignatura_equivalente_id = v_row.asignatura_id and x.estado = 'aprobada' and x.es_erasmus is true
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$fn$;



revoke execute on function public._aprobados(uuid) from public, anon, authenticated;
revoke execute on function public.mi_resumen() from public, anon, authenticated;
grant execute on function public.mi_resumen() to authenticated;
revoke execute on function public.resumen_amigo(text) from public, anon, authenticated;
grant execute on function public.resumen_amigo(text) to authenticated;
