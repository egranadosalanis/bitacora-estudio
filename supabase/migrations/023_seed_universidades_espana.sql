-- ============================================================
-- Migración: amplía el catálogo de universidades canónicas con las
-- universidades de Huelva, Granada, Cádiz, Almería, Jaén, Córdoba,
-- Málaga, Santander, Zaragoza, Barcelona y Valencia (incluida Loyola).
--
-- Solo siembra universidades (no carreras ni asignaturas). Cada usuario
-- podrá elegirlas ya en el buscador y las carreras se irán añadiendo por
-- alta libre + normalización.
--
-- ES IDEMPOTENTE: `on conflict (nombre_normalizado) do nothing`.
-- ============================================================

insert into public.universidades_canonicas (nombre, pais, estado, origen)
values
  -- Sevilla
  ('Universidad Loyola Andalucía', 'España', 'aprobada', 'seed'),
  ('Universidad Pablo de Olavide', 'España', 'aprobada', 'seed'),
  -- Huelva
  ('Universidad de Huelva', 'España', 'aprobada', 'seed'),
  -- Granada
  ('Universidad de Granada', 'España', 'aprobada', 'seed'),
  -- Cádiz
  ('Universidad de Cádiz', 'España', 'aprobada', 'seed'),
  -- Almería
  ('Universidad de Almería', 'España', 'aprobada', 'seed'),
  -- Jaén
  ('Universidad de Jaén', 'España', 'aprobada', 'seed'),
  -- Córdoba
  ('Universidad de Córdoba', 'España', 'aprobada', 'seed'),
  -- Málaga
  ('Universidad de Málaga', 'España', 'aprobada', 'seed'),
  -- Santander
  ('Universidad de Cantabria', 'España', 'aprobada', 'seed'),
  ('Universidad Internacional Menéndez Pelayo', 'España', 'aprobada', 'seed'),
  ('Universidad Europea del Atlántico', 'España', 'aprobada', 'seed'),
  -- Zaragoza
  ('Universidad de Zaragoza', 'España', 'aprobada', 'seed'),
  ('Universidad San Jorge', 'España', 'aprobada', 'seed'),
  -- Barcelona
  ('Universitat de Barcelona', 'España', 'aprobada', 'seed'),
  ('Universitat Autònoma de Barcelona', 'España', 'aprobada', 'seed'),
  ('Universitat Politècnica de Catalunya', 'España', 'aprobada', 'seed'),
  ('Universitat Pompeu Fabra', 'España', 'aprobada', 'seed'),
  ('Universitat Ramon Llull', 'España', 'aprobada', 'seed'),
  ('Universitat Oberta de Catalunya', 'España', 'aprobada', 'seed'),
  ('Universitat Internacional de Catalunya', 'España', 'aprobada', 'seed'),
  ('Universitat Abat Oliba CEU', 'España', 'aprobada', 'seed'),
  -- Valencia
  ('Universitat de València', 'España', 'aprobada', 'seed'),
  ('Universitat Politècnica de València', 'España', 'aprobada', 'seed'),
  ('Universidad Católica de Valencia San Vicente Mártir', 'España', 'aprobada', 'seed'),
  ('Universidad Europea de Valencia', 'España', 'aprobada', 'seed'),
  ('Universidad CEU Cardenal Herrera', 'España', 'aprobada', 'seed'),
  ('Universidad Internacional de Valencia', 'España', 'aprobada', 'seed')
on conflict (nombre_normalizado) do nothing;
