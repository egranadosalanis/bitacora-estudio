-- Solo LECTURA. Pegar en el SQL Editor y enviarme los 4 resultados
-- (Supabase muestra solo el último: ejecuta cada bloque por separado).

-- A. Tablas del esquema public y si tienen RLS activado.
select c.relname as tabla, c.relrowsecurity as rls_activado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- B. Políticas existentes.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by 1, 2;

-- C. Quién puede ejecutar cada función de public (anon = sin sesión).
select p.proname as funcion, p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('service_role', p.oid, 'execute') as service_role
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by 1;

-- D. Columnas de profiles (para confirmar plan / premium_promo_granted_at).
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' order by ordinal_position;
