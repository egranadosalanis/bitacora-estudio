-- ============================================================
-- Migración 019: nombres reservados y sello de verificación.
--   * Tabla social_reservados: nombres que nadie más puede usar. "cleveradmin"
--     queda reservado para el propietario (se localiza por su email).
--     Se bloquean también las imitaciones (mayúsculas, puntos, guiones bajos,
--     0/o, 1/i/l, 3/e, 4/a, 5/s, 7/t) mientras contengan un nombre reservado.
--   * perfil_social.verificado: el sello. Solo lo pone el servidor (al crear
--     el perfil con un nombre reservado a esa persona, o esta migración).
--     Nadie puede escribirlo desde la app.
--   * buscar_usuarios, mis_amistades, resumen_amigo y listado_aprobados
--     devuelven ahora también `verificado`.
-- No borra datos. Rollback: rollback/019_volver_a_sin_verificado.sql
-- ============================================================

create table if not exists public.social_reservados (
  nombre text primary key check (nombre = lower(nombre)),
  user_id uuid references public.profiles(id) on delete set null
);
alter table public.social_reservados enable row level security;
revoke all on public.social_reservados from anon, authenticated;

alter table public.perfil_social add column if not exists verificado boolean not null default false;

insert into public.social_reservados (nombre, user_id)
select 'cleveradmin', (select id from public.profiles where lower(email) = 'egranadosalanis@gmail.com' limit 1)
on conflict (nombre) do nothing;

insert into public.social_reservados (nombre, user_id) values
  ('cleveroficial', null), ('cleversoporte', null), ('cleversupport', null)
on conflict (nombre) do nothing;

-- Si el propietario ya tiene perfil social, se le marca verificado.
update public.perfil_social ps set verificado = true
from public.social_reservados r
where r.nombre = 'cleveradmin' and r.user_id = ps.user_id;

create or replace function public._username_normalizado(p_username text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select regexp_replace(translate(lower(p_username), '0134571l', 'oieastii'), '[._]', '', 'g')
$fn$;

-- ¿Este nombre está reservado para otra persona (o para nadie)?
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

create or replace function public.crear_perfil_social(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid(); v_u text := trim(p_username);
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if exists (select 1 from public.perfil_social where user_id = v_me) then
    raise exception 'perfil_ya_existe' using errcode = 'PS001';
  end if;
  if public._username_reservado(v_u, v_me) then
    raise exception 'username_reservado' using errcode = 'PS002';
  end if;
  insert into public.perfil_social (user_id, username, verificado)
  values (v_me, v_u, exists (select 1 from public.social_reservados where nombre = 'cleveradmin' and user_id = v_me));
exception
  when unique_violation then raise exception 'username_en_uso' using errcode = '23505';
  when check_violation then raise exception 'username_invalido' using errcode = '22023';
end;
$fn$;

create or replace function public.cambiar_username(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Hace falta iniciar sesión.' using errcode = '42501'; end if;
  if public._username_reservado(trim(p_username), v_me) then
    raise exception 'username_reservado' using errcode = 'PS002';
  end if;
  update public.perfil_social set username = trim(p_username), updated_at = now() where user_id = v_me;
  if not found then raise exception 'sin_perfil_social' using errcode = 'P0002'; end if;
exception
  when unique_violation then raise exception 'username_en_uso' using errcode = '23505';
  when check_violation then raise exception 'username_invalido' using errcode = '22023';
end;
$fn$;

drop function if exists public.mis_amistades();
create function public.mis_amistades()
returns table (id uuid, username text, verificado boolean, estado text, direccion text)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.id, ps.username, ps.verificado, a.estado,
         case when a.solicitante = auth.uid() then 'enviada' else 'recibida' end
  from public.amistades a
  join public.perfil_social ps
    on ps.user_id = case when a.solicitante = auth.uid() then a.receptor else a.solicitante end
  where auth.uid() in (a.solicitante, a.receptor)
    and (a.estado in ('pendiente', 'aceptada') or (a.estado = 'bloqueada' and a.bloqueado_por = auth.uid()))
  order by a.estado, ps.username
$fn$;

drop function if exists public.buscar_usuarios(text);
create function public.buscar_usuarios(p_query text)
returns table (username text, verificado boolean)
language sql
stable
security definer
set search_path = public
as $fn$
  select ps.username, ps.verificado
  from public.perfil_social ps
  where auth.uid() is not null
    and ps.user_id <> auth.uid()
    and trim(p_query) <> ''
    and (
      (length(trim(p_query)) >= 3 and starts_with(lower(ps.username), lower(trim(p_query))))
      or lower(ps.username) = lower(trim(p_query))
    )
    and not exists (
      select 1 from public.amistades a
      where a.estado = 'bloqueada' and a.bloqueado_por = ps.user_id
        and least(a.solicitante, a.receptor) = least(auth.uid(), ps.user_id)
        and greatest(a.solicitante, a.receptor) = greatest(auth.uid(), ps.user_id)
    )
  order by ps.verificado desc, ps.username
  limit 10
$fn$;

drop function if exists public.listado_aprobados(uuid);
create function public.listado_aprobados(p_canonica uuid)
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
  select ps.username, ps.verificado, round(x.hpc, 2), x.nota, public._desgaste_indice(x.asignatura_id), x.cursos_necesarios
  from public._aprobados(p_canonica) x
  join public.perfil_social ps on ps.user_id = x.user_id and ps.share_ranking_ok
  order by x.nota desc nulls last, x.hpc, ps.username
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
    'verificado', (select verificado from public.perfil_social where user_id = v_other),
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
  foreach f in array array[
    'crear_perfil_social(text)', 'cambiar_username(text)', 'mis_amistades()', 'buscar_usuarios(text)',
    'resumen_amigo(text)', 'listado_aprobados(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_username_normalizado(text)', '_username_reservado(text, uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$fn$;
