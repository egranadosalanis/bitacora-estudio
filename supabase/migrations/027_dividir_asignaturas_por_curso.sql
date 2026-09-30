-- ============================================================
-- Migración 027: divide en INTENTOS las asignaturas con registros en varios cursos.
--   Una asignatura con horas en más de un curso académico (rango de fechas de tu tabla
--   `cursos`) se convierte en un intento por curso:
--     * el curso más antiguo se queda con la fila original;
--     * cada curso posterior pasa a una fila nueva (mismo nombre, créditos, color, catálogo...)
--       a la que se mueven las entradas de estudio de ese curso;
--     * todos los intentos anteriores al último quedan "suspendida", sin datos de aprobado;
--     * el último intento conserva el estado, la nota, los cursos necesarios y la fecha de
--       aprobación que tenía la asignatura original;
--     * los intentos nuevos quedan combinados ("Combinar con") con la original, así que
--       cuentan juntos como una sola asignatura, como en la migración 026.
--   Las asignaturas de Erasmus no se dividen. Las entradas fuera de cualquier curso se quedan
--   en la fila original. Es idempotente: tras dividir, cada fila tiene registros en un solo
--   curso, así que volver a ejecutarla no hace nada.
--   Antes de tocar nada guarda copias en asignaturas_backup_027 y entradas_estudio_backup_027.
-- Para ver qué se dividiría sin ejecutar nada, ejecuta solo la consulta de vista previa
-- (la que va justo antes de esta migración en el mensaje / al final de este archivo).
-- ============================================================

create table if not exists public.asignaturas_backup_027 as select * from public.asignaturas;
create table if not exists public.entradas_estudio_backup_027 as select * from public.entradas_estudio;

do $mig$
declare
  r record;
  c record;
  v_new uuid;
  v_n int;
  v_i int;
begin
  for r in
    select a.*
    from public.asignaturas a
    where a.es_erasmus is not true
      and (
        select count(distinct cu.id)
        from public.entradas_estudio e
        join public.cursos cu on cu.user_id = a.user_id and e.fecha between cu.start_date and cu.end_date
        where e.asignatura_id = a.id
      ) > 1
    order by a.created_at, a.id
  loop
    -- cursos con registros de esta asignatura, del más antiguo al más reciente
    select count(*) into v_n from (
      select distinct cu.id
      from public.entradas_estudio e
      join public.cursos cu on cu.user_id = r.user_id and e.fecha between cu.start_date and cu.end_date
      where e.asignatura_id = r.id
    ) x;
    v_i := 0;
    for c in
      select cu.id, cu.start_date, cu.end_date
      from public.cursos cu
      where cu.user_id = r.user_id
        and exists (select 1 from public.entradas_estudio e
                    where e.asignatura_id = r.id and e.fecha between cu.start_date and cu.end_date)
      order by cu.start_date, cu.id
    loop
      v_i := v_i + 1;
      if v_i = 1 then continue; end if; -- el curso más antiguo se queda con la fila original

      v_new := gen_random_uuid();
      insert into public.asignaturas
      select * from jsonb_populate_record(
        null::public.asignaturas,
        to_jsonb(r) || jsonb_build_object(
          'id', v_new,
          'created_at', clock_timestamp(),
          'origin_curso_id', c.id,
          'asignatura_equivalente_id', r.id,
          -- solo el último intento conserva el estado y los datos de aprobado
          'estado', case when v_i = v_n then r.estado else 'suspendida' end,
          'frozen_nota', case when v_i = v_n then r.frozen_nota else null end,
          'frozen_cursos_necesarios', case when v_i = v_n then r.frozen_cursos_necesarios else null end,
          'frozen_fecha_aprobacion', case when v_i = v_n then r.frozen_fecha_aprobacion else null end
        )
      );

      update public.entradas_estudio
      set asignatura_id = v_new
      where asignatura_id = r.id and fecha between c.start_date and c.end_date;
    end loop;

    -- la fila original pasa a ser el primer intento: suspendido y sin datos de aprobado
    update public.asignaturas
    set estado = 'suspendida', frozen_nota = null, frozen_cursos_necesarios = null, frozen_fecha_aprobacion = null
    where id = r.id;
  end loop;
end;
$mig$;

-- ------------------------------------------------------------
-- VISTA PREVIA (solo lectura): asignaturas que se dividirían y en cuántos intentos.
--
-- select a.user_id, a.nombre, a.estado, count(distinct cu.id) as cursos_con_registros,
--        string_agg(distinct cu.name, ', ') as cursos
-- from public.asignaturas a
-- join public.entradas_estudio e on e.asignatura_id = a.id
-- join public.cursos cu on cu.user_id = a.user_id and e.fecha between cu.start_date and cu.end_date
-- where a.es_erasmus is not true
-- group by a.user_id, a.id, a.nombre, a.estado
-- having count(distinct cu.id) > 1
-- order by a.nombre;
-- ------------------------------------------------------------
