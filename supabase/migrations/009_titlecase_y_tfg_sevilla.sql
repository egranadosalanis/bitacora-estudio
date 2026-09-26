-- ============================================================
-- 1) Pone en formato título (mayúscula inicial en cada palabra,
--    salvo preposiciones/artículos/conjunciones) los nombres de las
--    filas canónicas sembradas (origen = 'seed'). No toca nada de lo
--    que un usuario haya escrito él mismo (alta_libre/migracion) —
--    eso lo revisa un admin con "renombrar y aprobar" si hace falta.
--
--    Reglas: la primera palabra siempre en mayúscula inicial; una
--    palabra que ya trae alguna mayúscula (siglas como "TFG", números
--    romanos "II", nombres propios "Física") se deja tal cual, no se
--    fuerza a minúsculas el resto; solo se capitaliza una palabra que
--    esté SIEMPRE en minúsculas.
--
-- 2) Añade "Trabajo Fin de Grado" (12 créditos, 4º curso) a Grado en
--    Ingeniería Aeroespacial de la Universidad de Sevilla — no venía
--    en la tabla de asignaturas de la web de la ETSI (el TFG a veces
--    se lista aparte), pero es una asignatura real que hace falta
--    para poder vincular los TFG que ya tienen los usuarios.
--
-- ES IDEMPOTENTE: la función es "create or replace", el update de
-- nombres es determinista (aplicarlo dos veces no cambia nada la
-- segunda vez), y el insert del TFG usa on conflict do nothing.
-- ============================================================

create or replace function public.titlecase_es(input text)
returns text
language plpgsql
immutable
as $$
declare
  stopwords text[] := array['de','del','la','las','el','los','y','e','o','u','en','a','al','para','con','por','sin','sobre','entre'];
  alpha text := 'A-Za-zÀ-ÖØ-öø-ÿ';
  words text[];
  result text[] := '{}';
  i int;
  w text;
  m text[];
  prefix text;
  core text;
  suffix text;
begin
  if input is null then return null; end if;
  words := regexp_split_to_array(trim(input), '\s+');
  for i in 1..coalesce(array_length(words, 1), 0) loop
    w := words[i];
    m := regexp_match(w, '^([^' || alpha || ']*)([' || alpha || '].*[' || alpha || ']|[' || alpha || '])?([^' || alpha || ']*)$');
    if m is null or m[2] is null or m[2] = '' then
      result := array_append(result, w);
      continue;
    end if;
    prefix := coalesce(m[1], '');
    core := m[2];
    suffix := coalesce(m[3], '');
    if i > 1 and core = lower(core) and lower(core) = any(stopwords) then
      core := lower(core);
    elsif core = lower(core) then
      core := upper(left(core, 1)) || substring(core from 2);
    end if;
    -- si core ya trae alguna mayúscula (TFG, II, Física...) se deja igual
    result := array_append(result, prefix || core || suffix);
  end loop;
  return array_to_string(result, ' ');
end;
$$;

revoke execute on function public.titlecase_es(text) from public, anon, authenticated;
grant execute on function public.titlecase_es(text) to service_role;

update public.universidades_canonicas
set nombre = public.titlecase_es(nombre)
where origen = 'seed' and nombre <> public.titlecase_es(nombre);

update public.carreras_canonicas
set nombre = public.titlecase_es(nombre)
where origen = 'seed' and nombre <> public.titlecase_es(nombre);

update public.asignaturas_canonicas
set nombre_oficial = public.titlecase_es(nombre_oficial)
where origen = 'seed' and nombre_oficial <> public.titlecase_es(nombre_oficial);

-- ---------- Trabajo Fin de Grado — Sevilla, Aeroespacial ----------
insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, anio, estado, origen)
select 'Trabajo Fin de Grado', c.id, 12, 4, 'aprobada', 'seed'
from public.carreras_canonicas c
join public.universidades_canonicas u on u.id = c.universidad_id
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería Aeroespacial')
on conflict (carrera_id, nombre_normalizado) do nothing;
