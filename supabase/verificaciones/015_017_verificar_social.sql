-- Verificación de Social (015-017). Crea 3 usuarios FICTICIOS con datos y lo
-- prueba todo; termina con un error a propósito, así que NO queda nada.
do $fn$
declare
  ua uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  ub uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  uc uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  uni uuid; car uuid; can uuid; sa uuid; sb uuid;
  r text := E'\n'; n int; ok boolean; j jsonb;
begin
  insert into auth.users (id, email) values (ua, 'a@test.invalid'), (ub, 'b@test.invalid'), (uc, 'c@test.invalid');
  insert into public.universidades_canonicas (nombre, estado, origen) values ('UniTest', 'aprobada', 'seed') returning id into uni;
  insert into public.carreras_canonicas (nombre, universidad_id, estado, origen) values ('CarTest', uni, 'aprobada', 'seed') returning id into car;
  insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, estado, origen) values ('AsigTest', car, 6, 'aprobada', 'seed') returning id into can;
  insert into public.asignaturas (user_id, nombre, creditos, estado, asignatura_canonica_id, frozen_nota, frozen_cursos_necesarios)
    values (ua, 'Asig A', 6, 'aprobada', can, 8, 1) returning id into sa;
  insert into public.asignaturas (user_id, nombre, creditos, estado, asignatura_canonica_id, frozen_nota, frozen_cursos_necesarios)
    values (ub, 'Asig B', 6, 'aprobada', can, 6, 2) returning id into sb;
  -- A: 5 días seguidos x 120 min (600 min). B: 3 días seguidos x 60 min (180 min).
  insert into public.entradas_estudio (user_id, asignatura_id, fecha, minutos)
    select ua, sa, d, 120 from generate_series('2026-01-10'::date, '2026-01-14'::date, '1 day') d;
  insert into public.entradas_estudio (user_id, asignatura_id, fecha, minutos)
    select ub, sb, d, 60 from generate_series('2026-02-01'::date, '2026-02-03'::date, '1 day') d;

  -- ===== perfiles =====
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.crear_perfil_social('Alice');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.crear_perfil_social('bob_x');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.crear_perfil_social('carol');
  reset role; update public.perfil_social set share_metrics_ok = true, share_metrics_at = now(), share_metrics_version = 'v0';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true); set local role authenticated;
  ok := false; begin perform public.crear_perfil_social('ALICE'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: nombre de usuario repetido (ALICE)' || E'\n';
  ok := false; begin perform public.crear_perfil_social('ab'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: nombre de usuario de 2 letras' || E'\n';
  ok := false; begin perform public.crear_perfil_social('a b c'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: nombre de usuario con espacios' || E'\n';
  ok := false; begin insert into public.perfil_social (user_id, username) values (uc, 'otro_x'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: insert directo en perfil_social' || E'\n';
  ok := false; begin update public.perfil_social set share_metrics_ok = true where user_id = uc; get diagnostics n = row_count; if n = 0 then raise exception 'sin filas'; end if; exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: update directo en perfil_social (ponerse el consentimiento a mano)' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.perfil_social where user_id = ub;
  r := r || case when coalesce((n = 0), false) then 'OK   ' else 'FALLO' end || ' no lee el perfil social de otro' || E'\n';

  -- ===== búsqueda =====
  select count(*) into n from public.buscar_usuarios('bo');
  r := r || case when coalesce((n = 0), false) then 'OK   ' else 'FALLO' end || ' buscar con 2 letras no devuelve nada' || E'\n';
  select count(*) into n from public.buscar_usuarios('bob');
  r := r || case when coalesce((n = 1), false) then 'OK   ' else 'FALLO' end || ' buscar bob (3 letras) encuentra a bob_x' || E'\n';
  select count(*) into n from public.buscar_usuarios('alice');
  r := r || case when coalesce((n = 0), false) then 'OK   ' else 'FALLO' end || ' no te encuentras a ti mismo' || E'\n';
  select count(*) into n from public.buscar_usuarios('%');
  r := r || case when coalesce((n = 0), false) then 'OK   ' else 'FALLO' end || ' el comodín % no lista a todos' || E'\n';

  -- ===== solicitudes =====
  perform public.solicitar_amistad('bob_x');
  ok := false; begin perform public.solicitar_amistad('bob_x'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: solicitud repetida' || E'\n';
  ok := false; begin perform public.solicitar_amistad('nadie_existe'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: solicitar a alguien que no existe' || E'\n';
  ok := false; begin perform public.solicitar_amistad('alice'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: solicitarse a sí mismo' || E'\n';
  ok := false; begin insert into public.amistades (solicitante, receptor, estado) values (ua, uc, 'aceptada'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: insert directo en amistades' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.amistades;
  r := r || case when coalesce((n = 0), false) then 'OK   ' else 'FALLO' end || ' un tercero no ve amistades ajenas' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.mis_amistades() where estado = 'pendiente' and direccion = 'recibida' and username = 'Alice';
  r := r || case when coalesce((n = 1), false) then 'OK   ' else 'FALLO' end || ' bob ve la solicitud recibida' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  ok := false; begin perform public.responder_solicitud((select id from public.mis_amistades() limit 1), true); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: el solicitante acepta su propia solicitud' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.responder_solicitud((select id from public.mis_amistades() where username = 'Alice'), true);

  -- ===== resumen de amigo: consentimientos =====
  reset role; update public.perfil_social set share_metrics_ok = false where user_id in (ua, ub);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  ok := false; begin perform public.resumen_amigo('bob_x'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: resumen sin haber aceptado tú compartir' || E'\n';
  perform public.establecer_consentimiento('metricas', true, 'v1');
  ok := false; begin perform public.resumen_amigo('bob_x'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: resumen si el otro no ha aceptado' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.establecer_consentimiento('metricas', true, 'v1');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  j := public.resumen_amigo('bob_x');
  r := r || case when coalesce(((j->>'minutos_totales')::int = 180), false) then 'OK   ' else 'FALLO' end || ' resumen: minutos totales 180' || E'\n';
  r := r || case when coalesce(((j->>'n_asignaturas')::int = 1), false) then 'OK   ' else 'FALLO' end || ' resumen: 1 asignatura' || E'\n';
  r := r || case when coalesce((abs((j->>'horas_por_credito')::numeric - 0.5) < 0.001), false) then 'OK   ' else 'FALLO' end || ' resumen: h/crédito 0.5' || E'\n';
  r := r || case when coalesce((jsonb_array_length(j->'historial') = 3), false) then 'OK   ' else 'FALLO' end || ' resumen: historial de 3 días' || E'\n';
  r := r || case when coalesce(((j->'asignaturas'->0->'nota') = 'null'::jsonb), false) then 'OK   ' else 'FALLO' end || ' resumen: nota oculta por defecto' || E'\n';
  r := r || case when coalesce((j::text !~* '[0-9a-f]{8}-[0-9a-f]{4}-'), false) then 'OK   ' else 'FALLO' end || ' resumen: sin uuid en la respuesta' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.establecer_mostrar_notas(true);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  j := public.resumen_amigo('bob_x');
  r := r || case when coalesce(((j->'asignaturas'->0->>'nota')::numeric = 6), false) then 'OK   ' else 'FALLO' end || ' con el interruptor activado se ve la nota (6)' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.establecer_consentimiento('metricas', false, null);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  ok := false; begin perform public.resumen_amigo('bob_x'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: tras retirar el permiso (efecto inmediato)' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.establecer_consentimiento('metricas', true, 'v1');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.establecer_consentimiento('metricas', true, 'v1');
  ok := false; begin perform public.resumen_amigo('alice'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: un no-amigo ve el resumen' || E'\n';

  -- ===== comunidad =====
  j := public.comunidad_stats(can);
  r := r || case when coalesce(((j->>'n')::int = 2), false) then 'OK   ' else 'FALLO' end || ' comunidad: n = 2' || E'\n';
  r := r || case when coalesce((abs((j->>'horas_por_credito_media')::numeric - 1.08) < 0.011), false) then 'OK   ' else 'FALLO' end || ' comunidad: h/crédito media 1.08' || E'\n';
  r := r || case when coalesce(((j->>'minutos_medios')::int = 390), false) then 'OK   ' else 'FALLO' end || ' comunidad: minutos medios 390' || E'\n';
  r := r || case when coalesce((abs((j->>'desgaste_medio')::numeric - 4.37) < 0.02), false) then 'OK   ' else 'FALLO' end || ' comunidad: desgaste medio 4.37 (5.03 y 3.70)' || E'\n';
  r := r || case when coalesce(((j->>'pct_aprobado_primera')::numeric = 50), false) then 'OK   ' else 'FALLO' end || ' comunidad: 50% aprobado a la primera' || E'\n';
  r := r || case when coalesce(((j->>'cursos_necesarios_medio')::numeric = 1.5), false) then 'OK   ' else 'FALLO' end || ' comunidad: cursos necesarios medios 1.5' || E'\n';
  r := r || case when coalesce(((j->'tramos'->0->>'n')::int = 1 and (j->'tramos'->1->>'n')::int = 1 and (j->'tramos'->2->>'n')::int = 0), false) then 'OK   ' else 'FALLO' end || ' comunidad: tramos 5-6.9 (1), 7-8.9 (1), 9+ (0)' || E'\n';
  r := r || case when coalesce((j::text !~* 'alice|bob|[0-9a-f]{8}-[0-9a-f]{4}-'), false) then 'OK   ' else 'FALLO' end || ' comunidad: sin nombres ni ids en la respuesta' || E'\n';
  ok := false; begin perform * from public._aprobados(can); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: llamar a la función interna _aprobados' || E'\n';
  ok := false; begin perform public._desgaste_indice(sa); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: llamar a la función interna _desgaste_indice' || E'\n';

  -- ===== listado de aprobados =====
  ok := false; begin perform * from public.listado_aprobados(can); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: listado sin haber aceptado aparecer' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.establecer_consentimiento('ranking', true, 'v1');
  perform public.establecer_mostrar_notas(true);
  select count(*) into n from public.listado_aprobados(can);
  r := r || case when coalesce((n = 1), false) then 'OK   ' else 'FALLO' end || ' listado: solo aparece quien aceptó (1: alice)' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.establecer_consentimiento('ranking', true, 'v1');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.listado_aprobados(can);
  r := r || case when coalesce((n = 2), false) then 'OK   ' else 'FALLO' end || ' listado: con bob también aceptado salen 2' || E'\n';
  select count(*) into n from public.listado_aprobados(can) where username = 'Alice' and nota = 8 and cursos_necesarios = 1 and desgaste_maximo = 5.03;
  r := r || case when coalesce((n = 1), false) then 'OK   ' else 'FALLO' end || ' listado: campos de alice (nota 8, 1 curso, desgaste 5.03)' || E'\n';

  -- ===== bloqueo y quitar amigo =====
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.bloquear_usuario('alice');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  ok := false; begin perform public.resumen_amigo('bob_x'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: bloqueado: ver el resumen' || E'\n';
  ok := false; begin perform public.solicitar_amistad('bob_x'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: bloqueado: volver a solicitar' || E'\n';
  select count(*) into n from public.buscar_usuarios('bob');
  r := r || case when coalesce((n = 0), false) then 'OK   ' else 'FALLO' end || ' bloqueado: bob no aparece en su búsqueda' || E'\n';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.desbloquear_usuario('alice');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.solicitar_amistad('bob_x');
  perform public.quitar_amistad('bob_x');
  perform public.solicitar_amistad('bob_x');

  -- ===== sin sesión =====
  reset role; perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); set local role anon;
  ok := false; begin perform * from public.buscar_usuarios('alice'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: anon: buscar usuarios' || E'\n';
  ok := false; begin perform public.comunidad_stats(can); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: anon: comunidad_stats' || E'\n';
  ok := false; begin perform * from public.perfil_social; exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no debe poder: anon: leer perfil_social' || E'\n';
  reset role;

  raise exception 'RESULTADOS (transacción deshecha, no se ha cambiado nada):%', r;
end $fn$;
