-- ============================================================
-- Migración 026: "Combinar con" funciona por GRUPOS.
--   * Todas las asignaturas enlazadas entre sí (directa o indirectamente, en cualquier
--     dirección) forman un grupo: un intento anterior suspendido, la cursada en Erasmus...
--   * En cuanto alguna del grupo está aprobada, el grupo cuenta como UNA asignatura aprobada
--     (horas, cursos, h/cr), sin aprobar las demás. Los cursos necesarios = en cuántos cursos
--     está metido el grupo (nunca menos que lo fijado al aprobar).
--   * La nota del listado y de las estadísticas es la de la asignatura de tu universidad:
--     si solo se aprobó en Erasmus no hay nota (no entra en la correlación h/cr → nota,
--     pero sus horas sí cuentan). En el detalle del listado, con Erasmus salen dos filas.
--   * Afecta a _aprobados, comunidad_stats, listado_aprobados, resumen_amigo, mi_resumen
--     y detalle_aprobado.
--   * DEJA TODAS LAS ASIGNATURAS SIN COMBINAR (asignatura_equivalente_id = null): hay que
--     volver a enlazarlas a mano con la lógica nueva. Esto NO se puede deshacer con el rollback.
-- Rollback: rollback/026_volver_a_combinadas_aprobadas.sql (restaura las funciones, no los enlaces)
-- ============================================================

update public.asignaturas set asignatura_equivalente_id = null where asignatura_equivalente_id is not null;

-- Grupo de cada asignatura de un usuario: componentes conexas del grafo de enlaces.
create or replace function public._grupos_usuario(p_user uuid)
returns table (asignatura_id uuid, grupo uuid)
language sql
stable
security definer
set search_path = public
as $fn$
  with recursive arista(a, b) as (
    select id, asignatura_equivalente_id from public.asignaturas
    where user_id = p_user and asignatura_equivalente_id is not null
    union
    select asignatura_equivalente_id, id from public.asignaturas
    where user_id = p_user and asignatura_equivalente_id is not null
  ), alc(origen, destino) as (
    select id, id from public.asignaturas where user_id = p_user
    union
    select alc.origen, arista.b from alc join arista on arista.a = alc.destino
  )
  select origen, min(destino::text)::uuid from alc group by origen
$fn$;

create or replace function public._grupo_miembros(p_asignatura uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select g2.asignatura_id
  from public.asignaturas a
  cross join lateral public._grupos_usuario(a.user_id) g1
  cross join lateral public._grupos_usuario(a.user_id) g2
  where a.id = p_asignatura and g1.asignatura_id = p_asignatura and g2.grupo = g1.grupo
$fn$;

-- Cursos en los que están metidas unas asignaturas: los cursos con registros suyos o en los
-- que se crearon; nunca menos que los "cursos necesarios" fijados al aprobar alguna.
create or replace function public._cursos_miembros(p_user uuid, p_ids uuid[])
returns int
language sql
stable
security definer
set search_path = public
as $fn$
  select greatest(
    (select count(*) from public.cursos c
     where c.user_id = p_user and exists (
       select 1 from public.asignaturas a
       where a.id = any(p_ids) and (
         a.origin_curso_id = c.id
         or exists (select 1 from public.entradas_estudio e
                    where e.asignatura_id = a.id and e.fecha between c.start_date and c.end_date)))),
    coalesce((select max(a.frozen_cursos_necesarios) from public.asignaturas a
              where a.id = any(p_ids) and a.estado = 'aprobada'), 0)
  )::int
$fn$;

create or replace function public._desgaste_miembros(p_ids uuid[])
returns numeric
language sql
stable
security definer
set search_path = public
as $fn$
  select max(public._desgaste_indice(m)) from unnest(p_ids) m
$fn$;

create or replace function public._desgaste_grupo(p_asignatura uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $fn$
  select max(public._desgaste_indice(m)) from public._grupo_miembros(p_asignatura) m
$fn$;

-- Grupos aprobados de un usuario (uno por grupo con alguna asignatura aprobada y una de tu
-- universidad). Se identifican por la asignatura "base" (no Erasmus, prefiriendo la aprobada
-- y la más reciente). nota = la de la última aprobada no Erasmus (null si solo aprobó en Erasmus).
create or replace function public._grupos_aprobados(p_user uuid)
returns table (base_id uuid, canonica uuid, creditos numeric, minutos numeric, cursos int, nota numeric, miembros uuid[])
language sql
stable
security definer
set search_path = public
as $fn$
  with m as (
    select g.grupo, a.id, a.estado, a.es_erasmus, a.creditos, a.asignatura_canonica_id,
           a.frozen_nota, a.frozen_fecha_aprobacion, a.created_at
    from public._grupos_usuario(p_user) g
    join public.asignaturas a on a.id = g.asignatura_id
  ), base as (
    select distinct on (grupo) grupo, id as base_id, asignatura_canonica_id as canonica, creditos
    from m where es_erasmus is not true
    order by grupo, (estado = 'aprobada') desc, created_at desc, id
  ), agg as (
    select grupo, bool_or(estado = 'aprobada') as aprobada, array_agg(id) as miembros from m group by grupo
  ), nt as (
    select distinct on (grupo) grupo, frozen_nota from m
    where estado = 'aprobada' and es_erasmus is not true
    order by grupo, frozen_fecha_aprobacion desc nulls last, created_at desc
  )
  select b.base_id, b.canonica, b.creditos,
         coalesce((select sum(e.minutos) from public.entradas_estudio e where e.asignatura_id = any(agg.miembros)), 0)::numeric,
         public._cursos_miembros(p_user, agg.miembros), nt.frozen_nota, agg.miembros
  from base b join agg using (grupo) left join nt using (grupo)
  where agg.aprobada
$fn$;

create or replace function public._aprobados(p_canonica uuid)
returns table (user_id uuid, asignatura_id uuid, minutos numeric, hpc numeric, nota numeric, cursos_necesarios int)
language sql
stable
security definer
set search_path = public
as $fn$
  select u.user_id, g.base_id, g.minutos, g.minutos / 60.0 / g.creditos, g.nota, g.cursos
  from (select distinct a.user_id from public.asignaturas a where a.asignatura_canonica_id = p_canonica) u
  cross join lateral public._grupos_aprobados(u.user_id) g
  join public.asignaturas_canonicas c on c.id = g.canonica
  where g.canonica = p_canonica
    and c.is_erasmus is not true and c.no_credits is not true and c.estado <> 'rechazada'
    and g.creditos > 0 and g.minutos > 0
$fn$;


create or replace function public.comunidad_stats(p_canonica uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare v_min int := public.social_min_n(); v_n int; v_res jsonb; v_excl boolean;
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;

  select (is_erasmus or no_credits) into v_excl from public.asignaturas_canonicas where id = p_canonica;
  if not found or v_excl then
    return jsonb_build_object('excluida', true);
  end if;

  select count(*) into v_n from public._aprobados(p_canonica);
  if v_n < v_min then
    return jsonb_build_object('n', v_n, 'min_n', v_min, 'suficiente', false);
  end if;

  with ap as (
    select x.*, public._desgaste_grupo(x.asignatura_id) as desg from public._aprobados(p_canonica) x
  ), tot as (
    select count(*) as n, avg(hpc) as hpc_m, avg(minutos) as min_m,
           percentile_cont(0.25) within group (order by hpc) as q1,
           percentile_cont(0.75) within group (order by hpc) as q3,
           avg(desg) as desg_m, avg(cursos_necesarios) as cur_m,
           100.0 * count(*) filter (where cursos_necesarios = 1) / nullif(count(*) filter (where cursos_necesarios is not null), 0) as pct1
    from ap
  ), tr as (
    select t.tramo, t.lo, count(ap.asignatura_id) as n, avg(ap.hpc) as hpc_m, avg(ap.cursos_necesarios) as cur_m,
           avg(ap.desg) as desg_m,
           100.0 * count(*) filter (where ap.cursos_necesarios = 1) / nullif(count(*) filter (where ap.cursos_necesarios is not null), 0) as pct1
    from (values ('5-6.9', 5, 7), ('7-8.9', 7, 9), ('9+', 9, 11)) as t(tramo, lo, hi)
    left join ap on ap.nota >= t.lo and ap.nota < t.hi
    group by t.tramo, t.lo
  )
  select jsonb_build_object(
    'n', tot.n, 'min_n', v_min, 'suficiente', true,
    'horas_por_credito_media', round(tot.hpc_m, 2),
    'minutos_medios', round(tot.min_m, 0),
    'horas_por_credito_q1', round(tot.q1::numeric, 2),
    'horas_por_credito_q3', round(tot.q3::numeric, 2),
    'horas_por_credito_iqr', round((tot.q3 - tot.q1)::numeric, 2),
    'desgaste_medio', round(tot.desg_m, 2),
    'pct_aprobado_primera', round(tot.pct1, 1),
    'cursos_necesarios_medio', round(tot.cur_m, 2),
    'tramos', (
      select jsonb_agg(jsonb_build_object(
        'tramo', tr.tramo, 'n', tr.n,
        'horas_por_credito_media', case when tr.n >= v_min then round(tr.hpc_m, 2) end,
        'pct_aprobado_primera', case when tr.n >= v_min then round(tr.pct1, 1) end,
        'cursos_necesarios_medio', case when tr.n >= v_min then round(tr.cur_m, 2) end,
        'desgaste_medio', case when tr.n >= v_min then round(tr.desg_m, 2) end
      ) order by tr.lo) from tr)
  ) into v_res
  from tot;

  return v_res;
end;
$fn$;

create or replace function public.listado_aprobados(p_canonica uuid)
returns table (username text, verificado boolean, horas_por_credito numeric, nota numeric, desgaste_maximo numeric, cursos_necesarios int)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if not coalesce((select share_ranking_ok from public.perfil_social where user_id = auth.uid()), false) then
    raise exception 'consentimiento_propio_requerido' using errcode = '42501';
  end if;

  return query
  select ps.username, ps.verificado, round(x.hpc, 2), case when ps.show_grades then x.nota end,
         public._desgaste_grupo(x.asignatura_id), x.cursos_necesarios
  from public._aprobados(p_canonica) x
  join public.perfil_social ps on ps.user_id = x.user_id and ps.share_ranking_ok
  order by (case when ps.show_grades then x.nota end) desc nulls last, x.hpc, ps.username
  limit 200;
end;
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

  with ga as (select * from public._grupos_aprobados(v_other)),
  subj as (
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
           ga.minutos as minutos_computables, ga.cursos as cursos_grupo, ga.nota as nota_grupo,
           (ga.base_id is not null) as aprobada_grupo
    from subj s
    left join own o on o.asignatura_id = s.id
    left join ga on ga.base_id = s.id
  ),
  tot as (
    select coalesce(sum(minutos), 0) as minutos_totales, count(*) as n_asignaturas,
           sum(minutos_computables) filter (where aprobada_grupo and not sin_creditos and creditos > 0) as min_apr,
           sum(creditos) filter (where aprobada_grupo and not sin_creditos and creditos > 0) as cred_apr
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
        'ref', d.ref, 'nombre', d.nombre, 'creditos', d.creditos, 'estado', case when d.aprobada_grupo then 'aprobada' else d.estado end, 'color', d.color,
        'es_erasmus', d.es_erasmus, 'sin_creditos', d.sin_creditos, 'minutos', d.minutos,
        'horas_por_credito', case when d.aprobada_grupo and not d.sin_creditos and d.creditos > 0
                                  then round(d.minutos_computables / 60.0 / d.creditos, 3) end,
        'cursos_necesarios', d.cursos_grupo,
        'nota', case when v_notas then d.nota_grupo end
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

  with ga as (select * from public._grupos_aprobados(v_me)),
  subj as (
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
           ga.minutos as minutos_computables, ga.cursos as cursos_grupo, ga.nota as nota_grupo,
           (ga.base_id is not null) as aprobada_grupo
    from subj s
    left join own o on o.asignatura_id = s.id
    left join ga on ga.base_id = s.id
  ),
  tot as (
    select coalesce(sum(minutos), 0) as minutos_totales, count(*) as n_asignaturas,
           sum(minutos_computables) filter (where aprobada_grupo and not sin_creditos and creditos > 0) as min_apr,
           sum(creditos) filter (where aprobada_grupo and not sin_creditos and creditos > 0) as cred_apr
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
        'ref', d.ref, 'nombre', d.nombre, 'creditos', d.creditos, 'estado', case when d.aprobada_grupo then 'aprobada' else d.estado end, 'color', d.color,
        'es_erasmus', d.es_erasmus, 'sin_creditos', d.sin_creditos, 'minutos', d.minutos,
        'horas_por_credito', case when d.aprobada_grupo and not d.sin_creditos and d.creditos > 0
                                  then round(d.minutos_computables / 60.0 / d.creditos, 3) end,
        'cursos_necesarios', d.cursos_grupo,
        'nota', case when v_notas then d.nota_grupo end
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

-- Detalle de un aprobado del listado: una fila con la asignatura de tu universidad (con sus
-- intentos combinados) y, si hay una cursada en Erasmus, una segunda fila con ella y su nota.
-- La nota de Erasmus se ve aquí, pero nunca entra en las estadísticas de la comunidad.
create or replace function public.detalle_aprobado(p_canonica uuid, p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_x record;
  v_ids uuid[]; v_prop uuid[]; v_eras uuid[];
  v_b record; v_er record;
  v_min_p numeric; v_min_e numeric; v_nota_p numeric;
  v_filas jsonb;
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if not coalesce((select share_ranking_ok from public.perfil_social where user_id = auth.uid()), false) then
    raise exception 'consentimiento_propio_requerido' using errcode = '42501';
  end if;

  select x.user_id, x.asignatura_id, x.hpc, ps.username, ps.verificado, ps.show_grades
  into v_x
  from public._aprobados(p_canonica) x
  join public.perfil_social ps on ps.user_id = x.user_id and ps.share_ranking_ok
  where lower(ps.username) = lower(trim(p_username));
  if not found then raise exception 'no_disponible' using errcode = '42501'; end if;

  select array_agg(m) into v_ids from public._grupo_miembros(v_x.asignatura_id) m;
  select array_agg(a.id) filter (where a.es_erasmus is not true),
         array_agg(a.id) filter (where a.es_erasmus is true)
  into v_prop, v_eras
  from public.asignaturas a where a.id = any(v_ids);

  select b.creditos, c.nombre_oficial into v_b
  from public.asignaturas b join public.asignaturas_canonicas c on c.id = b.asignatura_canonica_id
  where b.id = v_x.asignatura_id;
  select coalesce(sum(e.minutos), 0) into v_min_p from public.entradas_estudio e where e.asignatura_id = any(v_prop);
  select a.frozen_nota into v_nota_p from public.asignaturas a
  where a.id = any(v_prop) and a.estado = 'aprobada'
  order by a.frozen_fecha_aprobacion desc nulls last, a.created_at desc limit 1;

  v_filas := jsonb_build_array(jsonb_build_object(
    'tipo', 'principal', 'nombre', v_b.nombre_oficial, 'creditos', v_b.creditos, 'minutos', v_min_p,
    'horas_por_credito', case when v_b.creditos > 0 then round(v_min_p / 60.0 / v_b.creditos, 2) end,
    'cursos_necesarios', public._cursos_miembros(v_x.user_id, v_prop),
    'desgaste_maximo', public._desgaste_miembros(v_prop),
    'nota', case when v_x.show_grades then v_nota_p end));

  if v_eras is not null then
    select a.creditos, a.frozen_nota into v_er from public.asignaturas a
    where a.id = any(v_eras)
    order by (a.estado = 'aprobada') desc, a.frozen_fecha_aprobacion desc nulls last, a.created_at desc limit 1;
    select coalesce(sum(e.minutos), 0) into v_min_e from public.entradas_estudio e where e.asignatura_id = any(v_eras);
    v_filas := v_filas || jsonb_build_array(jsonb_build_object(
      'tipo', 'erasmus',
      'nombre', (select string_agg(a.nombre, ' + ' order by a.created_at) from public.asignaturas a where a.id = any(v_eras)),
      'creditos', v_er.creditos, 'minutos', v_min_e,
      'horas_por_credito', case when v_er.creditos > 0 then round(v_min_e / 60.0 / v_er.creditos, 2) end,
      'cursos_necesarios', public._cursos_miembros(v_x.user_id, v_eras),
      'desgaste_maximo', public._desgaste_miembros(v_eras),
      'nota', case when v_x.show_grades then v_er.frozen_nota end));
  end if;

  return jsonb_build_object(
    'username', v_x.username, 'verificado', v_x.verificado,
    'horas_por_credito_total', round(v_x.hpc, 2), 'filas', v_filas);
end;
$fn$;

do $fn$
declare f text;
begin
  foreach f in array array['_grupos_usuario(uuid)', '_grupo_miembros(uuid)', '_cursos_miembros(uuid, uuid[])',
                           '_desgaste_miembros(uuid[])', '_desgaste_grupo(uuid)', '_grupos_aprobados(uuid)', '_aprobados(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['detalle_aprobado(uuid, text)', 'mi_resumen()', 'resumen_amigo(text)', 'comunidad_stats(uuid)', 'listado_aprobados(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$fn$;
