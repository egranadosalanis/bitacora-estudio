-- ============================================================
-- Migración: permite a cada usuario borrar su propio perfil.
-- Necesaria para el botón "Eliminar cuenta" de la app — al borrar
-- la fila de profiles, el "on delete cascade" del esquema se lleva
-- también sus cursos, asignaturas y registros de estudio.
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- ============================================================

create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);
