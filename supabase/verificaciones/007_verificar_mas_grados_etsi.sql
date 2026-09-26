-- ============================================================
-- Verificación de 007_seed_etsi_sevilla_mas_grados.sql. Solo
-- lecturas — no modifica nada. Ejecutar después de la migración.
-- ============================================================

-- 1. Recuento de asignaturas sembradas por carrera de la ETSI Sevilla
-- (comparar a ojo: Tecnologías Industriales ~56, Telecomunicación
-- ~88, Civil ~62, Química ~58, Organización Industrial ~50,
-- Electrónica/Robótica/Mecatrónica ~51, Energía ~59).
select c.nombre as carrera, count(*) as asignaturas
from public.asignaturas_canonicas a
join public.carreras_canonicas c on c.id = a.carrera_id
join public.universidades_canonicas u on u.id = c.universidad_id
where a.origen = 'seed' and u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
group by c.nombre
order by c.nombre;

-- 2. Suma de créditos por año y cuatrimestre — ronda 30 ECTS por
-- cuatrimestre en 1º/2º; 3º/4º suelen salir más altos porque el
-- listado agrega varias optativas/menciones (normal, ver cabecera
-- del archivo de siembra).
select c.nombre as carrera, a.anio, a.cuatrimestre, sum(a.creditos) as creditos
from public.asignaturas_canonicas a
join public.carreras_canonicas c on c.id = a.carrera_id
join public.universidades_canonicas u on u.id = c.universidad_id
where a.origen = 'seed' and u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
group by c.nombre, a.anio, a.cuatrimestre
order by c.nombre, a.anio, a.cuatrimestre;

-- 3. Cero duplicados por carrera.
select c.nombre as carrera, a.nombre_normalizado, count(*)
from public.asignaturas_canonicas a
join public.carreras_canonicas c on c.id = a.carrera_id
where a.origen = 'seed'
group by c.nombre, a.nombre_normalizado
having count(*) > 1;
-- Esperado: 0 filas.

-- 4. Las 7 carreras nuevas + la de Aeroespacial (006) están todas
-- bajo la misma fila de Universidad de Sevilla (nunca duplicada).
select count(*) from public.universidades_canonicas
where nombre_normalizado = public.normalizar_texto('Universidad de Sevilla');
-- Esperado: 1.
