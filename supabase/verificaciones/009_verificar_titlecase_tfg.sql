-- ============================================================
-- Verificación de 009_titlecase_y_tfg_sevilla.sql. Solo lecturas —
-- no modifica nada. Ejecutar después de la migración.
-- ============================================================

-- 1. Prueba suelta de la función sobre casos conocidos.
select
  public.titlecase_es('ciencia y tecnología de materiales aeroespaciales') as caso1,
  public.titlecase_es('Física I') as caso2,
  public.titlecase_es('Universidad Carlos III de Madrid') as caso3,
  public.titlecase_es('control por computador (RA)') as caso4;
-- Esperado: 'Ciencia y Tecnología de Materiales Aeroespaciales',
-- 'Física I' (sin cambios), 'Universidad Carlos III de Madrid' (sin
-- cambios), 'Control por Computador (RA)'.

-- 2. Ya no debería quedar ningún nombre sembrado con la primera
-- palabra en minúscula.
select 'universidad' as tipo, nombre from public.universidades_canonicas
where origen = 'seed' and nombre ~ '^\s*[a-zà-öø-ÿ]'
union all
select 'carrera', nombre from public.carreras_canonicas
where origen = 'seed' and nombre ~ '^\s*[a-zà-öø-ÿ]'
union all
select 'asignatura', nombre_oficial from public.asignaturas_canonicas
where origen = 'seed' and nombre_oficial ~ '^\s*[a-zà-öø-ÿ]';
-- Esperado: 0 filas.

-- 3. El Trabajo Fin de Grado de Sevilla-Aeroespacial ya existe.
select a.nombre_oficial, a.creditos, a.anio
from public.asignaturas_canonicas a
join public.carreras_canonicas c on c.id = a.carrera_id
join public.universidades_canonicas u on u.id = c.universidad_id
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería Aeroespacial')
  and a.nombre_normalizado = public.normalizar_texto('Trabajo Fin de Grado');
-- Esperado: 1 fila, 12 créditos, 4º curso.
