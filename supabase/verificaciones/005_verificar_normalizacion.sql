-- ============================================================
-- Verificación de 005_normalizacion_canonica.sql. Solo lecturas —
-- no modifica nada. Ejecutar después de la migración.
-- ============================================================

-- 1. Extensiones instaladas.
select extname from pg_extension where extname in ('pg_trgm', 'unaccent');
-- Esperado: 2 filas (pg_trgm, unaccent).

-- 2. RLS activo en las 6 tablas nuevas.
select relname, relrowsecurity
from pg_class
where relname in (
  'universidades_canonicas', 'carreras_canonicas', 'asignaturas_canonicas',
  'universidades_alias', 'carreras_alias', 'asignaturas_alias'
);
-- Esperado: 6 filas, todas con relrowsecurity = true.

-- 3. Columnas de enlace nuevas en profiles/asignaturas.
select table_name, column_name
from information_schema.columns
where table_name in ('profiles', 'asignaturas')
  and column_name in ('universidad_canonica_id', 'carrera_canonica_id', 'asignatura_canonica_id', 'es_erasmus')
order by table_name, column_name;
-- Esperado: 4 filas.

-- 4. La fusión solo la puede ejecutar el service_role (nunca un
-- usuario normal desde el cliente).
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_name = 'fusionar_normalizacion';
-- Esperado: únicamente la fila con grantee = 'service_role'.

-- 5. Prueba manual de búsqueda difusa con una falta de tilde a
-- propósito (falla si 006 todavía no se ha ejecutado, es normal).
select * from public.buscar_universidades('sevila', 5);
-- Esperado, tras ejecutar 006: aparece "Universidad de Sevilla".

-- 6. Idempotencia: vuelve a ejecutar el archivo 005 completo justo
-- después de este script. No debe dar ningún error ni crear filas
-- nuevas en ninguna de las 6 tablas (mismo espíritu que el punto 3
-- de supabase/verificaciones/004_verificar_entradas.sql).
