-- Prueba con dos usuarios REALES sin modificar nada: todo ocurre dentro de
-- una transacción que termina con un error a propósito (así se deshace).
-- Ejecutar en el SQL Editor DESPUÉS de la 014. El resultado aparece como el
-- mensaje de "error" final: cada línea dice OK o FALLO.
-- Elige como "víctima" al usuario con más asignaturas y como "atacante" a
-- otro cualquiera.

do $$
declare
  victima uuid; atacante uuid; r text := E'\n'; n int; ok boolean;
begin
  select user_id into victima from public.asignaturas group by 1 order by count(*) desc limit 1;
  select id into atacante from public.profiles where id <> victima limit 1;
  if victima is null or atacante is null then
    raise exception 'Hacen falta al menos 2 usuarios, uno con asignaturas.';
  end if;

  select count(*) into n from public.asignaturas where user_id = victima;
  r := r || 'Datos reales de la víctima (asignaturas): ' || n || E'\n';

  -- ===== atacante con sesión (rol authenticated) =====
  perform set_config('request.jwt.claims', json_build_object('sub', atacante, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.asignaturas where user_id = victima;
  r := r || case when n = 0 then 'OK   ' else 'FALLO' end || ' lee asignaturas ajenas: ' || n || E'\n';
  select count(*) into n from public.cursos where user_id = victima;
  r := r || case when n = 0 then 'OK   ' else 'FALLO' end || ' lee cursos ajenos: ' || n || E'\n';
  select count(*) into n from public.entradas_estudio where user_id = victima;
  r := r || case when n = 0 then 'OK   ' else 'FALLO' end || ' lee entradas ajenas: ' || n || E'\n';
  select count(*) into n from public.profiles where id = victima;
  r := r || case when n = 0 then 'OK   ' else 'FALLO' end || ' lee perfil ajeno: ' || n || E'\n';

  update public.asignaturas set nombre = nombre where user_id = victima;
  get diagnostics n = row_count;
  r := r || case when n = 0 then 'OK   ' else 'FALLO' end || ' modifica asignaturas ajenas: ' || n || E'\n';
  delete from public.asignaturas where user_id = victima;
  get diagnostics n = row_count;
  r := r || case when n = 0 then 'OK   ' else 'FALLO' end || ' borra asignaturas ajenas: ' || n || E'\n';

  ok := false;
  begin
    insert into public.cursos (user_id, name, start_date, end_date) values (victima, 'x', now()::date, now()::date);
  exception when others then ok := true; end;
  r := r || case when ok then 'OK   ' else 'FALLO' end || ' inserta un curso a nombre de otro' || E'\n';

  ok := false;
  begin
    update public.profiles set plan = 'premium_historico' where id = atacante;
    get diagnostics n = row_count;
  exception when others then ok := true; end;
  r := r || case when ok then 'OK   ' else 'FALLO' end || ' se sube su propio plan a premium' || E'\n';

  ok := false;
  begin
    insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, estado, is_erasmus)
    select 'zz', id, 'aprobada', true from public.carreras_canonicas limit 1;
  exception when others then ok := true; end;
  r := r || case when ok then 'OK   ' else 'FALLO' end || ' inserta una canónica aprobada directamente' || E'\n';

  ok := false;
  begin
    insert into public.asignaturas_alias (asignatura_id, texto_usuario)
    select id, 'zz' from public.asignaturas_canonicas limit 1;
  exception when others then ok := true; end;
  r := r || case when ok then 'OK   ' else 'FALLO' end || ' inserta un alias directamente' || E'\n';

  ok := false;
  begin
    perform public.fusionar_normalizacion('universidad', gen_random_uuid(), gen_random_uuid());
  exception when others then ok := true; end;
  r := r || case when ok then 'OK   ' else 'FALLO' end || ' ejecuta fusionar_normalizacion' || E'\n';

  -- lo propio sí debe funcionar
  select count(*) into n from public.profiles where id = atacante;
  r := r || case when n = 1 then 'OK   ' else 'FALLO' end || ' lee su propio perfil: ' || n || E'\n';

  reset role;

  -- ===== sin sesión (rol anon) =====
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  n := 0;
  begin
    select count(*) into n from public.asignaturas;
  exception when others then n := 0; end;
  r := r || case when n = 0 then 'OK   ' else 'FALLO' end || ' anon lee asignaturas: ' || n || E'\n';
  begin
    select count(*) into n from public.profiles;
  exception when others then n := 0; end;
  r := r || case when n = 0 then 'OK   ' else 'FALLO' end || ' anon lee perfiles: ' || n || E'\n';
  ok := false;
  begin
    perform public.buscar_universidades('a');
  exception when others then ok := true; end;
  r := r || case when ok then 'OK   ' else 'FALLO' end || ' anon ejecuta buscar_universidades' || E'\n';
  reset role;

  raise exception 'RESULTADOS (transacción deshecha, no se ha cambiado nada):%', r;
end $$;
