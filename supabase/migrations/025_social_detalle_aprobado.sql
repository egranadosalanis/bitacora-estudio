-- ============================================================
-- Migración 025: detalle de un aprobado en el listado de la Guía.
--   Al pulsar un usuario del listado de aprobados de una asignatura se muestra:
--     * la asignatura canónica que aprobó, con sus parámetros (h/cr, cursos, desgaste, nota);
--     * debajo, la(s) asignatura(s) equivalente(s) ya aprobada(s) que aporta(n) horas
--       a esa (p. ej. la cursada en Erasmus), con sus propios parámetros y su nota.
--   Las horas de las equivalentes ya se suman al h/cr de la canónica (_aprobados); aquí solo
--   se enseña el desglose. La nota de una equivalente se muestra en este detalle, pero NUNCA
--   entra en comunidad_stats (la correlación h/cr → nota solo usa la nota de la canónica).
--   Las mismas reglas de visibilidad que listado_aprobados: quien mira y quien es mirado
--   han aceptado el listado, y la nota solo sale si esa persona tiene "mostrar mis notas".
-- No toca datos. Rollback: rollback/025_volver_a_sin_detalle_aprobado.sql
-- ============================================================

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
      where x.asignatura_equivalente_id = v_row.asignatura_id and x.estado = 'aprobada'
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$fn$;

revoke execute on function public.detalle_aprobado(uuid, text) from public, anon, authenticated;
grant execute on function public.detalle_aprobado(uuid, text) to authenticated;
