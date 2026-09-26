-- ============================================================
-- Verificación de 006_seed_asignaturas_sevilla_uc3m.sql. Solo
-- lecturas — no modifica nada. Ejecutar después de la migración.
-- ============================================================

-- 1. Recuento de asignaturas sembradas por carrera (comparar a ojo
-- con el listado del informe: ~73 en Sevilla, ~53 filas de origen en
-- UC3M, algunas menos tras colapsar "Prácticas externas I/II" que el
-- listado repite en los dos cuatrimestres del último curso).
select u.nombre as universidad, c.nombre as carrera, count(*) as asignaturas
from public.asignaturas_canonicas a
join public.carreras_canonicas c on c.id = a.carrera_id
join public.universidades_canonicas u on u.id = c.universidad_id
where a.origen = 'seed'
group by u.nombre, c.nombre
order by u.nombre;

-- 2. Suma de créditos por año — cada curso de un grado español ronda
-- 60 ECTS anuales (30 por cuatrimestre); un año muy alejado de eso
-- señala una fila mal transcrita o un curso con muchas optativas
-- agregadas (normal en los cursos 3º/4º de Sevilla).
select u.nombre as universidad, a.anio, a.cuatrimestre, sum(a.creditos) as creditos
from public.asignaturas_canonicas a
join public.carreras_canonicas c on c.id = a.carrera_id
join public.universidades_canonicas u on u.id = c.universidad_id
where a.origen = 'seed'
group by u.nombre, a.anio, a.cuatrimestre
order by u.nombre, a.anio, a.cuatrimestre;

-- 3. Cero duplicados por carrera (además de la unique constraint,
-- comprobación de cinturón y tirantes).
select c.nombre as carrera, a.nombre_normalizado, count(*)
from public.asignaturas_canonicas a
join public.carreras_canonicas c on c.id = a.carrera_id
where a.origen = 'seed'
group by c.nombre, a.nombre_normalizado
having count(*) > 1;
-- Esperado: 0 filas.
