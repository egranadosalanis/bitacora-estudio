-- ============================================================
-- Migración 016: Social — búsqueda de usuarios y resumen de un amigo.
-- Requiere la 015. No toca datos. Rollback: rollback/016_volver_a_sin_busqueda_resumen.sql
-- ============================================================

-- Solo devuelve nombres de usuario, como mucho 10, y solo si la búsqueda es
-- de 3+ caracteres (prefijo) o coincide exactamente. No se puede listar a todos.
create or replace function public.buscar_usuarios(p_query text)
returns table (username text)
language sql
stable
security definer
set search_path = public
as $fn$
  select ps.username
  from public.perfil_social ps
  where auth.uid() is not null
    and ps.user_id <> auth.uid()
    and trim(p_query) <> ''
    and (
      (length(trim(p_query)) >= 3 and starts_with(lower(ps.username), lower(trim(p_query))))
      or lower(ps.username) = lower(trim(p_query))
    )
    -- Quien te ha bloqueado no aparece.
    and not exists (
      select 1 from public.amistades a
      where a.estado = 'bloqueada' and a.bloqueado_por = ps.user_id
        and least(a.solicitante, a.receptor) = least(auth.uid(), ps.user_id)
        and greatest(a.solicitante, a.receptor) = greatest(auth.uid(), ps.user_id)
    )
  order by ps.username
  limit 10
$fn$;

-- Resumen de un amigo. Solo si: sois amigos aceptados, el otro ha aceptado
-- compartir Y tú también has aceptado compartir. Solo lectura y solo campos
-- resumidos (nunca filas crudas). El rango y la racha los calcula la app a
-- partir del historial.
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
             where e.asignatura_id = s.id
                or e.asignatura_id in (select x.id from public.asignaturas x where x.asignatura_equivalente_id = s.id and x.estado = 'aprobada')
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

do $fn$
declare f text;
begin
  foreach f in array array['buscar_usuarios(text)', 'resumen_amigo(text)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$fn$;
