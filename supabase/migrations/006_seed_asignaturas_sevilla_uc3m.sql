-- ============================================================
-- Migración: siembra de asignaturas canónicas para ETSI Sevilla y
-- UC3M (Grado en Ingeniería Aeroespacial), a partir del listado
-- oficial de cada universidad, para que los primeros usuarios de
-- Sevilla y Madrid encuentren su carrera ya cargada.
--
-- Depende de 005_normalizacion_canonica.sql (crea las tablas
-- canónicas que esta siembra rellena).
--
-- ES IDEMPOTENTE: usa `on conflict (..., nombre_normalizado) do
-- nothing`, así que ejecutarla más de una vez no duplica nada.
--
-- Revisa los listados antes de dar por buena esta siembra: puede
-- haber optativas que ya no se oferten en el curso actual, o
-- pequeñas diferencias de nombre respecto a lo que aparece en la
-- matrícula real (ver supabase/verificaciones/006_verificar_seed_sevilla_uc3m.sql).
-- ============================================================

-- ---------- Universidad de Sevilla ----------

insert into public.universidades_canonicas (nombre, pais, estado, origen)
values ('Universidad de Sevilla', 'España', 'aprobada', 'seed')
on conflict (nombre_normalizado) do nothing;

insert into public.carreras_canonicas (nombre, universidad_id, estado, origen)
select 'Grado en Ingeniería Aeroespacial', u.id, 'aprobada', 'seed'
from public.universidades_canonicas u
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
on conflict (universidad_id, nombre_normalizado) do nothing;

insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, anio, cuatrimestre, plan, estado, origen)
select v.nombre, c.id, v.creditos, v.anio, v.cuatrimestre, v.plan, 'aprobada', 'seed'
from public.carreras_canonicas c
join public.universidades_canonicas u on u.id = c.universidad_id
join (values
  ('Expresión gráfica', 6, 1, 'A', null::text),
  ('Informática', 6, 1, 'A', null::text),
  ('Empresa', 6, 1, 'C1', null::text),
  ('Física I', 6, 1, 'C1', null::text),
  ('Matemáticas I', 6, 1, 'C1', null::text),
  ('Matemáticas II', 6, 1, 'C1', null::text),
  ('Física II', 6, 1, 'C2', null::text),
  ('Introducción a la ingeniería aeroespacial', 6, 1, 'C2', null::text),
  ('Matemáticas III', 6, 1, 'C2', null::text),
  ('Química general', 6, 1, 'C2', null::text),
  ('Ampliación de física', 6, 2, 'C1', null::text),
  ('Ampliación de matemáticas', 4.5, 2, 'C1', null::text),
  ('Ciencia y tecnología de materiales aeroespaciales', 7.5, 2, 'C1', null::text),
  ('Elasticidad y resistencia de materiales', 6, 2, 'C1', null::text),
  ('Termodinámica', 6, 2, 'C1', null::text),
  ('Control automático', 4.5, 2, 'C2', null::text),
  ('Electrotecnia', 6, 2, 'C2', null::text),
  ('Estadística e investigación operativa', 4.5, 2, 'C2', null::text),
  ('Mecánica de fluidos I', 6, 2, 'C2', null::text),
  ('Métodos matemáticos', 4.5, 2, 'C2', null::text),
  ('Tecnología de fabricación', 4.5, 2, 'C2', null::text),
  ('Aerodinámica I', 4.5, 3, 'C1', null::text),
  ('Diseño y fabricación asistidos por ordenador', 4.5, 3, 'C1', null::text),
  ('Estructuras', 6, 3, 'C1', null::text),
  ('Fundamentos de propulsión', 4.5, 3, 'C1', null::text),
  ('Ingeniería electrónica', 6, 3, 'C1', null::text),
  ('Instalaciones eléctricas aeroportuarias', 4.5, 3, 'C1', null::text),
  ('Mecánica de fluidos II', 4.5, 3, 'C1', null::text),
  ('Operaciones aeroportuarias y transporte aéreo', 4.5, 3, 'C1', null::text),
  ('Sistemas de propulsión', 4.5, 3, 'C1', null::text),
  ('Señales y sistemas de radiofrecuencia', 4.5, 3, 'C1', null::text),
  ('Propagación de ondas y compatibilidad electromagnética', 4.5, 3, 'C2', null::text),
  ('Construcción de aeropuertos I', 6, 3, 'C2', null::text),
  ('Estructuras aeronáuticas', 6, 3, 'C2', null::text),
  ('Estructuras aeroportuarias I', 6, 3, 'C2', null::text),
  ('Fundamentos de navegación aérea', 7.5, 3, 'C2', null::text),
  ('Gestión y explotación de aeropuertos', 6, 3, 'C2', null::text),
  ('Instalaciones de fabricaciones y sistemas de producción', 6, 3, 'C2', null::text),
  ('Mecánica de máquinas y vibraciones', 6, 3, 'C2', null::text),
  ('Mecánica de sólidos', 6, 3, 'C2', null::text),
  ('Mecánica de vuelo y operaciones de vuelo', 6, 3, 'C2', null::text),
  ('Motores de aeronaves', 6, 3, 'C2', null::text),
  ('Planificación y diseño de aeropuertos', 6, 3, 'C2', null::text),
  ('Sistemas electrónicos de comunicaciones', 6, 3, 'C2', null::text),
  ('Tecnología electrónica', 6, 3, 'C2', null::text),
  ('Aerodinámica II', 4.5, 4, 'C1', null::text),
  ('Aviónica', 6, 4, 'C1', null::text),
  ('Aviónica y sistemas de ayuda a la navegación', 4.5, 4, 'C1', null::text),
  ('Construcción de aeropuertos II', 6, 4, 'C1', null::text),
  ('Estructuras aeroportuarias II', 4.5, 4, 'C1', null::text),
  ('Explotación del transporte aéreo', 4.5, 4, 'C1', null::text),
  ('Gestión del tráfico aéreo', 6, 4, 'C1', null::text),
  ('Instalaciones de aeropuertos', 6, 4, 'C1', null::text),
  ('Mecánica del vuelo', 6, 4, 'C1', null::text),
  ('Mecánica orbital y vehículos espaciales', 6, 4, 'C1', null::text),
  ('Sistemas de aeronaves', 4.5, 4, 'C1', null::text),
  ('Sistemas de ayuda a la navegación', 4.5, 4, 'C1', null::text),
  ('Sistemas eléctricos en aeronaves y aeropuertos', 4.5, 4, 'C1', null::text),
  ('Proyectos ingeniería aeroespacial', 4.5, 4, 'C1', null::text),
  ('Gestión de calidad', 4.5, 4, 'C2', null::text),
  ('Integración de sistemas y pruebas funcionales', 4.5, 4, 'C2', null::text),
  ('Integridad estructural de sistemas mecánicos', 4.5, 4, 'C2', null::text),
  ('Meteorología', 4.5, 4, 'C2', null::text),
  ('Vehículos aéreos no tripulados', 4.5, 4, 'C2', null::text),
  ('Análisis y prevención de riesgos laborales', 4.5, 4, 'C2', null::text),
  ('Cálculo de aeronaves', 4.5, 4, 'C2', null::text),
  ('Construcción de aeropuertos III', 4.5, 4, 'C2', null::text),
  ('Electrónica de consumo', 4.5, 4, 'C2', null::text),
  ('Matemática computacional', 4.5, 4, 'C2', null::text),
  ('Materiales aeroespaciales', 4.5, 4, 'C2', null::text),
  ('Metodología e historia de la ingeniería', 4.5, 4, 'C2', null::text),
  ('Óptica aplicada', 4.5, 4, 'C2', null::text),
  ('Sistemas de control y guiado', 4.5, 4, 'C2', null::text)
) as v(nombre, creditos, anio, cuatrimestre, plan) on true
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería Aeroespacial')
on conflict (carrera_id, nombre_normalizado) do nothing;

-- ---------- UC3M (Universidad Carlos III de Madrid) ----------

insert into public.universidades_canonicas (nombre, pais, estado, origen)
values ('Universidad Carlos III de Madrid', 'España', 'aprobada', 'seed')
on conflict (nombre_normalizado) do nothing;

insert into public.carreras_canonicas (nombre, universidad_id, estado, origen)
select 'Grado en Ingeniería Aeroespacial', u.id, 'aprobada', 'seed'
from public.universidades_canonicas u
where u.nombre_normalizado = public.normalizar_texto('Universidad Carlos III de Madrid')
on conflict (universidad_id, nombre_normalizado) do nothing;

insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, anio, cuatrimestre, plan, estado, origen)
select v.nombre, c.id, v.creditos, v.anio, v.cuatrimestre, v.plan, 'aprobada', 'seed'
from public.carreras_canonicas c
join public.universidades_canonicas u on u.id = c.universidad_id
join (values
  ('Cálculo I', 6, 1, '1', 'FB'),
  ('Álgebra Lineal', 6, 1, '1', 'FB'),
  ('Física I', 6, 1, '1', 'FB'),
  ('Programación', 6, 1, '1', 'FB'),
  ('Estadística', 6, 1, '1', 'FB'),
  ('Técnicas de Expresión Oral y Escrita', 3, 1, '2', 'FB'),
  ('Cálculo II', 6, 1, '2', 'FB'),
  ('Fundamentos Químicos en la Ingeniería', 6, 1, '2', 'FB'),
  ('Expresión Gráfica', 6, 1, '2', 'FB'),
  ('Física II', 6, 1, '2', 'FB'),
  ('Habilidades: Humanidades I', 3, 1, '2', 'O'),
  ('Mecánica de Fluidos I', 6, 2, '1', 'O'),
  ('Mecánica aplicada a la Ingeniería Aeroespacial', 6, 2, '1', 'O'),
  ('Ampliación de Matemáticas', 6, 2, '1', 'FB'),
  ('Fundamentos de Gestión Empresarial', 6, 2, '1', 'FB'),
  ('Materiales Aeroespaciales I', 6, 2, '1', 'O'),
  ('Modelización en Ingeniería Aeroespacial', 6, 2, '2', 'O'),
  ('Ingeniería Térmica', 6, 2, '2', 'O'),
  ('Elasticidad y Resistencia de Materiales', 6, 2, '2', 'O'),
  ('Materiales Aeroespaciales II', 6, 2, '2', 'O'),
  ('Mecánica de Fluidos II', 6, 2, '2', 'P*'),
  ('Aerodinámica I', 6, 3, '1', 'O'),
  ('Fundamentos de Ingeniería Electrónica', 6, 3, '1', 'O'),
  ('Estructuras Aeroespaciales', 6, 3, '1', 'O'),
  ('Sistemas e Instalaciones del Avión', 3, 3, '1', 'O'),
  ('Habilidades: Humanidades II', 3, 3, '1', 'O'),
  ('Propulsión Aeroespacial I', 6, 3, '1', 'P*'),
  ('Técnicas de Búsqueda y Uso de la Información', 1.5, 3, '2', 'O'),
  ('Mecánica de Vuelo I', 3, 3, '2', 'O'),
  ('Navegación, Transporte Aéreo y Aeropuertos', 6, 3, '2', 'O'),
  ('Diseño Aeroespacial I', 6, 3, '2', 'O'),
  ('Hojas de cálculo. Nivel avanzado', 1.5, 3, '2', 'O'),
  ('Estabilidad e Integridad de Estructuras Aeroespaciales', 6, 3, '2', 'P*'),
  ('Control de Sistemas Aeroespaciales', 6, 3, '2', 'P*'),
  ('Diseño Aeroespacial II', 6, 4, '1', 'O'),
  ('Habilidades profesionales interpersonales', 3, 4, '1', 'O'),
  ('Aerodinámica II (mención Vehículos Aeroespaciales)', 6, 4, '1', 'O-P'),
  ('Integración de Sistemas Embarcados (mención Vehículos Aeroespaciales)', 3, 4, '1', 'O-P'),
  ('Aeroelasticidad (mención Vehículos Aeroespaciales)', 3, 4, '1', 'O-P'),
  ('Diseño de Turbohélices (mención Propulsión Aeroespacial)', 3, 4, '1', 'O-P'),
  ('Combustión (mención Propulsión Aeroespacial)', 3, 4, '1', 'O-P'),
  ('Diseño de Turbomáquinas (mención Propulsión Aeroespacial)', 6, 4, '1', 'O-P'),
  ('Prácticas externas I', 6, 4, '1', 'P'),
  ('Prácticas externas II', 9, 4, '1', 'P'),
  ('Vehículos espaciales y dinámica orbital', 6, 4, '2', 'O'),
  ('Trabajo Fin de Grado', 12, 4, '2', 'TFG'),
  ('Diseño y cálculo de aeronaves', 6, 4, '2', 'P*'),
  ('Mecánica de Vuelo II (mención Vehículos Aeroespaciales)', 3, 4, '2', 'O-P'),
  ('Helicópteros y Aeronaves Diversas (mención Vehículos Aeroespaciales)', 3, 4, '2', 'O-P'),
  ('Propulsión Aeroespacial II (mención Propulsión Aeroespacial)', 3, 4, '2', 'O-P'),
  ('Motores Cohete (mención Propulsión Aeroespacial)', 3, 4, '2', 'O-P'),
  ('Prácticas externas I', 6, 4, '2', 'P'),
  ('Prácticas externas II', 9, 4, '2', 'P')
) as v(nombre, creditos, anio, cuatrimestre, plan) on true
where u.nombre_normalizado = public.normalizar_texto('Universidad Carlos III de Madrid')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería Aeroespacial')
on conflict (carrera_id, nombre_normalizado) do nothing;
