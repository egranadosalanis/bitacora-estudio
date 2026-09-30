-- Prueba de nombres reservados y sello de verificación con usuarios FICTICIOS.
-- Termina con un error a propósito: no queda nada.
do $fn$
declare
  ua uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  ub uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  r text := E'\n'; n int; ok boolean; v boolean;
begin
  insert into auth.users (id, email) values (ua, 'a@test.invalid'), (ub, 'b@test.invalid');
  -- Dentro de la transacción, la reserva de 'cleveradmin' se asigna al usuario ficticio ua.
  update public.social_reservados set user_id = ua where nombre = 'cleveradmin';

  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  ok := false; begin perform public.crear_perfil_social('cleveradmin'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' otro usuario no puede usar el nombre reservado' || E'\n';
  ok := false; begin perform public.crear_perfil_social('Clever_Admin'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' ni con mayúsculas y guion bajo' || E'\n';
  ok := false; begin perform public.crear_perfil_social('clever.adm1n'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' ni cambiando la i por un 1' || E'\n';
  ok := false; begin perform public.crear_perfil_social('xcleveradminx'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' ni metiéndolo dentro de otro nombre' || E'\n';
  ok := false; begin perform public.crear_perfil_social('cleveradmin'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' cleveradmin está reservado' || E'\n';
  ok := false; begin perform public.crear_perfil_social('Clever.Adm1n'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' imitación Clever.Adm1n bloqueada' || E'\n';
  ok := false; begin perform public.crear_perfil_social('cleveradm❤in'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' nombres con símbolos/emojis rechazados' || E'\n';
  perform public.crear_perfil_social('bob_x');
  select verificado into v from public.perfil_social where user_id = ub;
  r := r || case when v = false then 'OK   ' else 'FALLO' end || ' un usuario normal no está verificado' || E'\n';
  ok := false; begin perform public.cambiar_username('cleveradmin'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' tampoco puede cambiarse a un nombre reservado' || E'\n';
  ok := false; begin update public.perfil_social set verificado = true where user_id = ub; get diagnostics n = row_count; if n = 0 then raise exception 'x'; end if; exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no puede ponerse el sello desde la app' || E'\n';
  ok := false; begin insert into public.social_reservados (nombre) values ('mio'); exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' no puede reservar nombres' || E'\n';

  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.crear_perfil_social('cleveradmin');
  select verificado into v from public.perfil_social where user_id = ua;
  r := r || case when v = true then 'OK   ' else 'FALLO' end || ' el dueño de la reserva puede usarla y sale verificado' || E'\n';

  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  reset role; update public.perfil_social set share_metrics_ok = true, share_metrics_at = now(), share_metrics_version = 'v0'; reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.buscar_usuarios('cleveradmin') where verificado;
  r := r || case when n = 1 then 'OK   ' else 'FALLO' end || ' los demás lo ven verificado en la búsqueda' || E'\n';
  perform public.solicitar_amistad('cleveradmin');
  select count(*) into n from public.mis_amistades() where username = 'cleveradmin' and verificado;
  r := r || case when n = 1 then 'OK   ' else 'FALLO' end || ' y en la lista de amistades' || E'\n';

  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.responder_solicitud((select id from public.mis_amistades() limit 1), true);
  perform public.establecer_consentimiento('metricas', true, 'v1');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.establecer_consentimiento('metricas', true, 'v1');
  select count(*) into n from (select public.resumen_amigo('cleveradmin') ->> 'verificado' as vv) x where x.vv = 'true';
  r := r || case when n = 1 then 'OK   ' else 'FALLO' end || ' y en el resumen del amigo' || E'\n';

  reset role; perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); set local role anon;
  ok := false; begin perform * from public.social_reservados; exception when others then ok := true; end; r := r || case when ok then 'OK   ' else 'FALLO' end || ' sin sesión no se pueden leer las reservas' || E'\n';
  reset role;
  raise exception 'RESULTADOS (transacción deshecha, no se ha cambiado nada):%', r;
end $fn$;
