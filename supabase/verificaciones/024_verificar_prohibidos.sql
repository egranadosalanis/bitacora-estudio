-- Prueba de la lista de nombres prohibidos con usuarios FICTICIOS.
-- Termina con un error a propósito: no queda nada.
do $fn$
declare
  ua uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  r text := E'\n'; t text; bloqueado boolean;
  debe_bloquear text[] := array['puta', 'Puta2024', 'p.u.t.a', 'xxmierdaxx', 'Hijo_De_Puta', 'maric0n', 'sudaca99',
                                'f4ggot', 'Nazi', 'nazi_1', 'h1tler', 'Verga', 'pene'];
  debe_permitir text[] := array['computadora', 'apenas', 'disputa', 'Vergara', 'reputacion', 'ridiculo', 'americano',
                                'naziraOK', 'morocco', 'kike', 'bob_x', 'cleveralumno', 'estudiante_23'];
begin
  insert into auth.users (id, email) values (ua, 'a@test.invalid');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true); set local role authenticated;

  foreach t in array debe_bloquear loop
    bloqueado := false; begin perform public.crear_perfil_social(t); exception when others then bloqueado := true; end;
    r := r || case when bloqueado then 'OK   ' else 'FALLO' end || ' bloqueado: ' || t || E'\n';
  end loop;

  foreach t in array debe_permitir loop
    bloqueado := false;
    begin
      perform public.crear_perfil_social(t);
      delete from public.perfil_social where user_id = ua;
    exception when others then bloqueado := true; end;
    r := r || case when not bloqueado then 'OK   ' else 'FALLO' end || ' permitido: ' || t || E'\n';
  end loop;

  bloqueado := false; begin insert into public.social_prohibidos (palabra, modo) values ('mio', 'exacto'); exception when others then bloqueado := true; end;
  r := r || case when bloqueado then 'OK   ' else 'FALLO' end || ' un usuario no puede editar la lista' || E'\n';

  reset role;
  raise exception 'RESULTADOS (transacción deshecha, no se ha cambiado nada):%', r;
end $fn$;
