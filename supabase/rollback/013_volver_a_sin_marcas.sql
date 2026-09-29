-- VUELTA ATRÁS de la migración 013: quita las dos marcas de las
-- asignaturas canónicas. Se pierden los valores marcados; anótalos
-- antes si quieres poder restaurarlos.
alter table public.asignaturas_canonicas
  drop column if exists is_erasmus,
  drop column if exists no_credits;
