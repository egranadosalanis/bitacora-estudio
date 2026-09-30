-- ============================================================
-- Migración 024: lista de nombres de usuario prohibidos.
--   * Tabla social_prohibidos: palabras malsonantes y de odio (homofobia,
--     racismo, xenofobia, capacitismo, apología nazi...) que no se pueden usar
--     en un nombre de usuario. Se comparan con la misma normalización que los
--     nombres reservados (mayúsculas, puntos, guiones bajos, 0/o, 1/i/l, 3/e,
--     4/a, 5/s, 7/t).
--   * modo 'contiene': se bloquea si la palabra aparece dentro del nombre.
--     Solo para palabras que no forman parte de palabras normales.
--   * modo 'exacto': se bloquea si el nombre ES la palabra (con o sin números,
--     puntos o guiones bajos al final, p. ej. "puta2024"). Para palabras cortas
--     que darían falsos positivos ("puta" en "computadora", "pene" en "apenas",
--     "verga" en "Vergara").
--   * Se aplica dentro de _username_reservado, así que crear_perfil_social y
--     cambiar_username lo heredan sin cambios. Mismo error (username_reservado).
-- No borra datos ni toca nombres ya existentes. Para ampliar la lista basta con
-- insertar filas. Rollback: rollback/024_volver_a_sin_prohibidos.sql
-- ============================================================

create table if not exists public.social_prohibidos (
  palabra text primary key check (palabra = lower(palabra)),
  modo text not null check (modo in ('contiene', 'exacto'))
);
alter table public.social_prohibidos enable row level security;
revoke all on public.social_prohibidos from anon, authenticated;

insert into public.social_prohibidos (palabra, modo) values
  -- Malsonantes (español)
  ('mierda', 'contiene'), ('joder', 'contiene'), ('jodete', 'contiene'), ('jodido', 'contiene'),
  ('gilipollas', 'contiene'), ('gilipolla', 'contiene'), ('hijoputa', 'contiene'), ('hijodeputa', 'contiene'),
  ('hijueputa', 'contiene'), ('cabron', 'contiene'), ('cojones', 'contiene'), ('capullo', 'contiene'),
  ('chupapolla', 'contiene'), ('soplapolla', 'contiene'), ('lamecul', 'contiene'), ('follar', 'contiene'),
  ('gonorrea', 'contiene'), ('imbecil', 'contiene'), ('subnormal', 'contiene'),
  ('puta', 'exacto'), ('putas', 'exacto'), ('puto', 'exacto'), ('putos', 'exacto'), ('puton', 'exacto'),
  ('putita', 'exacto'), ('pene', 'exacto'), ('polla', 'exacto'), ('pollas', 'exacto'), ('verga', 'exacto'),
  ('culo', 'exacto'), ('culos', 'exacto'), ('cono', 'exacto'), ('zorra', 'exacto'), ('idiota', 'exacto'),
  ('pajero', 'exacto'), ('mamon', 'exacto'), ('mamada', 'exacto'), ('tetas', 'exacto'), ('hostia', 'exacto'),
  ('carajo', 'exacto'), ('hdp', 'exacto'), ('ctm', 'exacto'), ('anormal', 'exacto'),
  -- Malsonantes (inglés)
  ('fuck', 'contiene'), ('shit', 'contiene'), ('bitch', 'contiene'), ('cunt', 'contiene'),
  ('pussy', 'contiene'), ('whore', 'contiene'), ('asshole', 'contiene'), ('porno', 'contiene'),
  ('dick', 'exacto'), ('cock', 'exacto'), ('slut', 'exacto'), ('rape', 'exacto'), ('rapist', 'contiene'),
  -- Homofobia y transfobia
  ('maricon', 'contiene'), ('mariconazo', 'contiene'), ('marimacho', 'contiene'), ('julandron', 'contiene'),
  ('tortillera', 'contiene'), ('faggot', 'contiene'), ('tranny', 'contiene'),
  ('marica', 'exacto'), ('bollera', 'exacto'), ('bujarra', 'exacto'), ('sarasa', 'exacto'),
  ('mariposon', 'exacto'), ('machorra', 'exacto'), ('travelo', 'exacto'), ('fufa', 'exacto'), ('fag', 'exacto'),
  -- Racismo, xenofobia y capacitismo
  ('negrata', 'contiene'), ('sudaca', 'contiene'), ('nigger', 'contiene'), ('nigga', 'contiene'),
  ('mongolo', 'exacto'), ('retrasado', 'exacto'), ('moro', 'exacto'), ('chink', 'exacto'),
  ('sidoso', 'contiene'), ('retard', 'contiene'),
  -- Odio y extremismo
  ('hitler', 'contiene'), ('neonazi', 'contiene'), ('nazi', 'exacto'), ('kkk', 'exacto'),
  ('pedofilo', 'contiene'), ('pedofil', 'contiene'), ('violador', 'contiene')
on conflict (palabra) do nothing;

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
  ) or exists (
    select 1 from public.social_prohibidos p
    where (p.modo = 'contiene'
           and position(public._username_normalizado(p.palabra) in public._username_normalizado(p_username)) > 0)
       or (p.modo = 'exacto'
           and public._username_normalizado(p.palabra) in (
             public._username_normalizado(p_username),
             public._username_normalizado(regexp_replace(p_username, '[0-9._]+$', ''))
           ))
  )
$fn$;

revoke execute on function public._username_reservado(text, uuid) from public, anon, authenticated;
