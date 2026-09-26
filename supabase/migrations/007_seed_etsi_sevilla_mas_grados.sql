-- ============================================================
-- Migración: siembra de asignaturas canónicas para el resto de
-- grados de la ETSI Sevilla (además de Ingeniería Aeroespacial,
-- ya sembrado en 006). Mismo formato y misma fuente oficial
-- (etsi.us.es) que 006_seed_asignaturas_sevilla_uc3m.sql.
--
-- Depende de 005_normalizacion_canonica.sql. No depende de 006 (esta
-- migración inserta su propia fila de Universidad de Sevilla si
-- todavía no existe, igual que 006 — on conflict do nothing).
--
-- ES IDEMPOTENTE: mismo mecanismo que 006 (on conflict sobre el
-- nombre normalizado).
--
-- Revisa los listados antes de dar por buena esta siembra: puede
-- haber optativas que ya no se oferten en el curso actual, o
-- pequeñas diferencias de nombre respecto a lo que aparece en la
-- matrícula real.
--
-- Para deshacer esta siembra sirve el mismo
-- supabase/rollback/006_volver_a_sin_seed.sql (borra todo lo que
-- tenga origen = 'seed', sin distinguir de qué migración vino).
-- ============================================================

insert into public.universidades_canonicas (nombre, pais, estado, origen)
values ('Universidad de Sevilla', 'España', 'aprobada', 'seed')
on conflict (nombre_normalizado) do nothing;

-- ---------- Grado en Ingeniería de Tecnologías Industriales ----------

insert into public.carreras_canonicas (nombre, universidad_id, estado, origen)
select 'Grado en Ingeniería de Tecnologías Industriales', u.id, 'aprobada', 'seed'
from public.universidades_canonicas u
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
on conflict (universidad_id, nombre_normalizado) do nothing;

insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, anio, cuatrimestre, estado, origen)
select v.nombre, c.id, v.creditos, v.anio, v.cuatrimestre, 'aprobada', 'seed'
from public.carreras_canonicas c
join public.universidades_canonicas u on u.id = c.universidad_id
join (values
  ('Algebra Lineal', 6, 1, 'C1'),
  ('Calculo diferencial e integral', 12, 1, 'A'),
  ('Empresa', 6, 1, 'C2'),
  ('Expresión gráfica', 6, 1, 'A'),
  ('Física I', 6, 1, 'C1'),
  ('Física II', 6, 1, 'C2'),
  ('Fundamentos de ciencia de materiales', 6, 1, 'C2'),
  ('Informática', 6, 1, 'A'),
  ('Química', 6, 1, 'C1'),
  ('Ampliación de física', 9, 2, 'A'),
  ('Control Automático', 6, 2, 'C1'),
  ('Ecuaciones diferenciales', 4.5, 2, 'C1'),
  ('Elasticidad y resistencia de materiales', 6, 2, 'C1'),
  ('Electrónica', 6, 2, 'C2'),
  ('Estadística e investigación operativa', 6, 2, 'C1'),
  ('Mecánica de Fluidos', 6, 2, 'C2'),
  ('Métodos Numéricos', 4.5, 2, 'C2'),
  ('Teoría de Circuitos', 6, 2, 'A'),
  ('Termodinámica', 6, 2, 'C2'),
  ('Automatización industrial', 4.5, 3, 'C2'),
  ('Ingenería Estructural', 4.5, 3, 'C1'),
  ('Ingenería Térmica', 9, 3, 'A'),
  ('Organización y gestión de empresas', 6, 3, 'C1'),
  ('Tecnología de fabricación', 6, 3, 'C2'),
  ('Tecnología de materiales', 4.5, 3, 'C2'),
  ('Tecnología eléctrica', 9, 3, 'A'),
  ('Tecnología química', 4.5, 3, 'C1'),
  ('Tecnologías del medio ambiente', 6, 3, 'C2'),
  ('Teoría de máquinas y mecanismos', 6, 3, 'C1'),
  ('Ampliación de elasticidad y resistencia de materiales', 4.5, 4, 'C2'),
  ('Análisis y prevención de riesgos laborales', 4.5, 4, 'C2'),
  ('Bioingeniería', 4.5, 4, 'C2'),
  ('Diseño y Fabricación Asistido por Ordenador', 4.5, 4, 'C2'),
  ('Diseño y Proyecto de Estructuras para la Industria', 4.5, 4, 'C2'),
  ('Domótica', 4.5, 4, 'C2'),
  ('Electrónica de consumo', 4.5, 4, 'C2'),
  ('Energía solar', 4.5, 4, 'C2'),
  ('Gestión eficiente de la energía eléctrica', 4.5, 4, 'C2'),
  ('Industria y Medio Ambiente', 4.5, 4, 'C2'),
  ('Ingeniería de Datos', 4.5, 4, 'C1'),
  ('Laboratorio de Automática y Robótica', 4.5, 4, 'C2'),
  ('Logística', 4.5, 4, 'C2'),
  ('Máquinas Hidráulicas', 4.5, 4, 'C1'),
  ('Matemática computacional', 4.5, 4, 'C2'),
  ('Meteorología', 4.5, 4, 'C2'),
  ('Metodología e historia de la ingeniería', 4.5, 4, 'C2'),
  ('Monitorización y actuación en plantas industriales', 4.5, 4, 'C2'),
  ('Óptica aplicada', 4.5, 4, 'C2'),
  ('Proyectos', 6, 4, 'C1'),
  ('Simulación de Sistemas Industriales', 4.5, 4, 'C2'),
  ('Sistemas de Información', 4.5, 4, 'C2'),
  ('Sistemas de producción de potencia', 4.5, 4, 'C2'),
  ('Sistemas Eléctricos Sostenibles', 4.5, 4, 'C2'),
  ('Tecnología de Máquinas', 4.5, 4, 'C1'),
  ('Tecnología Electrónica', 4.5, 4, 'C1'),
  ('Tecnología Nuclear', 4.5, 4, 'C2')
) as v(nombre, creditos, anio, cuatrimestre) on true
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería de Tecnologías Industriales')
on conflict (carrera_id, nombre_normalizado) do nothing;

-- ---------- Grado en Ingeniería de las Tecnologías de Telecomunicación ----------

insert into public.carreras_canonicas (nombre, universidad_id, estado, origen)
select 'Grado en Ingeniería de las Tecnologías de Telecomunicación', u.id, 'aprobada', 'seed'
from public.universidades_canonicas u
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
on conflict (universidad_id, nombre_normalizado) do nothing;

insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, anio, cuatrimestre, estado, origen)
select v.nombre, c.id, v.creditos, v.anio, v.cuatrimestre, 'aprobada', 'seed'
from public.carreras_canonicas c
join public.universidades_canonicas u on u.id = c.universidad_id
join (values
  ('Física', 6, 1, 'C1'),
  ('Fundamentos de computadores', 6, 1, 'C1'),
  ('Fundamentos de programación I', 6, 1, 'C1'),
  ('Matemáticas I', 6, 1, 'C1'),
  ('Matemáticas II', 6, 1, 'C1'),
  ('Estadística', 6, 1, 'C2'),
  ('Fundamentos de programación II', 6, 1, 'C2'),
  ('Matemáticas III', 6, 1, 'C2'),
  ('Tecnología de dispositivos y componentes', 6, 1, 'C2'),
  ('Teoría de circuitos', 6, 1, 'C2'),
  ('Ampliación de física', 6, 2, 'C1'),
  ('Electrónica básica', 6, 2, 'C1'),
  ('Fundamentos de internet', 6, 2, 'C1'),
  ('Señales y sistemas', 6, 2, 'C1'),
  ('Control automático', 6, 2, 'C1'),
  ('Organización de empresas', 6, 2, 'C2'),
  ('Estructura y protocolos de redes públicas', 6, 2, 'C2'),
  ('Fundamentos de aplicaciones y servicios telemáticos', 6, 2, 'C2'),
  ('Propagación de ondas', 6, 2, 'C2'),
  ('Teoría de la comunicación', 6, 2, 'C2'),
  ('Circuitos de comunicaciones', 4.5, 3, 'C1'),
  ('Comunicaciones digitales', 6, 3, 'C1'),
  ('Electrónica de potencia', 4.5, 3, 'C1'),
  ('Electrónica digital', 4.5, 3, 'C1'),
  ('Métodos matemáticos', 4.5, 3, 'C1'),
  ('Redes multiservicio', 6, 3, 'C1'),
  ('Sistemas operativos', 4.5, 3, 'C1'),
  ('Tratamiento digital de señales multimedia', 4.5, 3, 'C1'),
  ('Medios de transmisión', 4.5, 3, 'C1'),
  ('Tratamiento digital de señales', 4.5, 3, 'C2'),
  ('Comunicaciones digitales avanzadas', 4.5, 3, 'C2'),
  ('Diseño de circuitos y sistemas electrónicos', 6, 3, 'C2'),
  ('Electrónica integrada', 4.5, 3, 'C2'),
  ('Fundamentos de comunicaciones ópticas', 4.5, 3, 'C2'),
  ('Fundamentos de procesamiento de imagen', 4.5, 3, 'C2'),
  ('Fundamentos de radiocomunicación', 6, 3, 'C2'),
  ('Gestión de redes de telecomunicación', 4.5, 3, 'C2'),
  ('Ingeniería acústica', 6, 3, 'C2'),
  ('Ingeniería de software', 6, 3, 'C2'),
  ('Seguridad', 4.5, 3, 'C2'),
  ('Sistemas de audio', 4.5, 3, 'C2'),
  ('Sistemas de infraestructura de telecomunicación', 6, 3, 'C2'),
  ('Sistemas electrónicos de comunicaciones', 4.5, 3, 'C2'),
  ('Sistemas electrónicos digitales', 4.5, 3, 'C2'),
  ('Tecnología electrónica', 4.5, 3, 'C2'),
  ('Teletráfico', 4.5, 3, 'C2'),
  ('Producción audiovisual', 4.5, 3, 'C2'),
  ('Equipos y sistemas de audio, vídeo y televisión', 4.5, 4, 'C1'),
  ('Arquitectura de redes avanzadas', 6, 4, 'C1'),
  ('Circuitos de alta frecuencia', 4.5, 4, 'C1'),
  ('Diseño de bases de datos', 4.5, 4, 'C1'),
  ('Equipos para sistemas de información multimedia', 4.5, 4, 'C1'),
  ('Ingeniería de control', 4.5, 4, 'C1'),
  ('Ingeniería de organización', 6, 4, 'C1'),
  ('Instrumentación electrónica', 6, 4, 'C1'),
  ('Medidas de ruido y legislación', 4.5, 4, 'C1'),
  ('Planificación y simulación de redes', 4.5, 4, 'C1'),
  ('Proyectos de sistemas de telecomunicación', 4.5, 4, 'C1'),
  ('Proyectos de sistemas electrónicos', 4.5, 4, 'C1'),
  ('Proyectos de sonido e imagen', 4.5, 4, 'C1'),
  ('Proyectos de telemática', 4.5, 4, 'C1'),
  ('Servicios telemáticos avanzados', 4.5, 4, 'C1'),
  ('Sistemas de radiocomunicación', 6, 4, 'C1'),
  ('Sistemas electrónicos para el procesamiento de señal', 4.5, 4, 'C1'),
  ('Sistemas emergentes de comunicaciones', 4.5, 4, 'C1'),
  ('Televisión', 6, 4, 'C1'),
  ('Tratamiento digital de señales en comunicaciones', 4.5, 4, 'C1'),
  ('Visión artificial', 4.5, 4, 'C1'),
  ('Análisis y prevención de riesgos laborales', 4.5, 4, 'C2'),
  ('Automatización y comunicaciones industriales', 4.5, 4, 'C2'),
  ('Bioingeniería', 4.5, 4, 'C2'),
  ('Comunicaciones móviles', 4.5, 4, 'C2'),
  ('Comunicaciones vía satélite', 4.5, 4, 'C2'),
  ('Diseño de aplicaciones móviles', 4.5, 4, 'C2'),
  ('Domótica', 4.5, 4, 'C2'),
  ('Electrónica de consumo', 4.5, 4, 'C2'),
  ('Holografía y visualización 3D', 4.5, 4, 'C2'),
  ('Instalaciones eléctricas de baja tensión', 4.5, 4, 'C2'),
  ('Matemática computacional', 4.5, 4, 'C2'),
  ('Metodología e historia de la ingeniería', 4.5, 4, 'C2'),
  ('Microsistemas', 4.5, 4, 'C2'),
  ('Óptica aplicada', 4.5, 4, 'C2'),
  ('Radiodeterminación y radionavegación', 4.5, 4, 'C2'),
  ('Redes de sensores y sistemas autónomos', 4.5, 4, 'C2'),
  ('Robótica', 4.5, 4, 'C2'),
  ('Sistemas distribuidos y servicios web', 4.5, 4, 'C2'),
  ('Técnicas de animación 3D', 4.5, 4, 'C2'),
  ('Tratamiento digital de imágenes médicas', 4.5, 4, 'C2')
) as v(nombre, creditos, anio, cuatrimestre) on true
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería de las Tecnologías de Telecomunicación')
on conflict (carrera_id, nombre_normalizado) do nothing;

-- ---------- Grado en Ingeniería Civil ----------

insert into public.carreras_canonicas (nombre, universidad_id, estado, origen)
select 'Grado en Ingeniería Civil', u.id, 'aprobada', 'seed'
from public.universidades_canonicas u
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
on conflict (universidad_id, nombre_normalizado) do nothing;

insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, anio, cuatrimestre, estado, origen)
select v.nombre, c.id, v.creditos, v.anio, v.cuatrimestre, 'aprobada', 'seed'
from public.carreras_canonicas c
join public.universidades_canonicas u on u.id = c.universidad_id
join (values
  ('Empresa', 6, 1, 'C1'),
  ('Estadística aplicada e investigación operativa', 6, 1, 'C2'),
  ('Expresión gráfica', 6, 1, 'A'),
  ('Física I', 6, 1, 'C1'),
  ('Física II', 6, 1, 'C2'),
  ('Informática', 6, 1, 'C2'),
  ('Matemáticas I', 6, 1, 'C1'),
  ('Matemáticas II', 6, 1, 'C1'),
  ('Matemáticas III', 6, 1, 'C2'),
  ('Química de los materiales', 6, 1, 'A'),
  ('Ampliación de matemáticas', 4.5, 2, 'C1'),
  ('Elasticidad', 4.5, 2, 'C1'),
  ('Electrotecnia', 4.5, 2, 'C1'),
  ('Geología aplicada a la ingeniería civil', 6, 2, 'C1'),
  ('Hidráulica e hidrología', 6, 2, 'C2'),
  ('Mecánica del suelo y rocas', 4.5, 2, 'C2'),
  ('Mecánica racional', 6, 2, 'C1'),
  ('Métodos matemáticos', 4.5, 2, 'C2'),
  ('Resistencia de materiales', 4.5, 2, 'C2'),
  ('Tecnología de materiales de construcción', 6, 2, 'C2'),
  ('Topografía', 4.5, 2, 'C1'),
  ('Urbanismo y ordenación del territorio', 4.5, 2, 'C2'),
  ('Cálculo de estructuras', 6, 3, 'C1'),
  ('Caminos', 4.5, 3, 'C2'),
  ('Geotecnia', 4.5, 3, 'C1'),
  ('Infraestructuras hidráulicas', 6, 3, 'C1'),
  ('Ingeniería civil y medio ambiente', 4.5, 3, 'C1'),
  ('Obras marítimas', 4.5, 3, 'C1'),
  ('Estructuras de hormigón I', 4.5, 3, 'C2'),
  ('Estructuras metálicas I', 4.5, 3, 'C2'),
  ('Ferrocarriles', 4.5, 3, 'C2'),
  ('Ingeniería sanitaria', 4.5, 3, 'C1'),
  ('Procedimientos generales de construcción', 6, 3, 'C2'),
  ('Proyectos y dirección de obras', 6, 3, 'C2'),
  ('Ampliación de cálculo de estructuras', 4.5, 4, 'C1'),
  ('Ampliación de hidráulica', 4.5, 4, 'C1'),
  ('Aprovechamientos hidráulicos', 4.5, 4, 'C1'),
  ('Construcciones civiles', 6, 4, 'C1'),
  ('Construcciones prefabricadas', 4.5, 4, 'C1'),
  ('Construcciones sanitarias', 4.5, 4, 'C2'),
  ('Estructuras de hormigón II', 4.5, 4, 'C2'),
  ('Estructuras metálicas II', 4.5, 4, 'C2'),
  ('Hidrología superficial y subterránea', 6, 4, 'C1'),
  ('Infraestructura de carreteras', 6, 4, 'C1'),
  ('Infraestructura ferroviaria', 4.5, 4, 'C2'),
  ('Ingeniería del transporte', 6, 4, 'C1'),
  ('Ingeniería y explotación portuaria', 4.5, 4, 'C1'),
  ('Obras geotécnicas', 6, 4, 'C1'),
  ('Obras hidráulicas', 6, 4, 'C1'),
  ('Servicios urbanos', 4.5, 4, 'C1'),
  ('Terminales e intercambiadores', 4.5, 4, 'C2'),
  ('Centrales hidroeléctricas', 4.5, 4, 'C2'),
  ('Diseño a fatiga en ingeniería civil', 4.5, 4, 'C2'),
  ('Geomática y sistemas de información geográfica', 4.5, 4, 'C2'),
  ('Estética de la ingeniería civil', 4.5, 4, 'C2'),
  ('Análisis y prevención de riesgos laborales', 4.5, 4, 'C2'),
  ('Matemática computacional', 4.5, 4, 'C2'),
  ('Metodología e historia de la ingeniería', 4.5, 4, 'C2'),
  ('Complementos de Construcciones Civiles', 4.5, 4, 'C1'),
  ('Complementos de Hidrología', 4.5, 4, 'C1'),
  ('Complementos de Transporte y Servicios Urbanos', 4.5, 4, 'C1'),
  ('Ingeniería Litoral y Fluvial', 4.5, 4, 'C2')
) as v(nombre, creditos, anio, cuatrimestre) on true
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería Civil')
on conflict (carrera_id, nombre_normalizado) do nothing;

-- ---------- Grado en Ingeniería Química ----------

insert into public.carreras_canonicas (nombre, universidad_id, estado, origen)
select 'Grado en Ingeniería Química', u.id, 'aprobada', 'seed'
from public.universidades_canonicas u
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
on conflict (universidad_id, nombre_normalizado) do nothing;

insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, anio, cuatrimestre, estado, origen)
select v.nombre, c.id, v.creditos, v.anio, v.cuatrimestre, 'aprobada', 'seed'
from public.carreras_canonicas c
join public.universidades_canonicas u on u.id = c.universidad_id
join (values
  ('Expresión gráfica', 6, 1, 'A'),
  ('Informática', 6, 1, 'A'),
  ('Empresa', 6, 1, 'C1'),
  ('Física I', 6, 1, 'C1'),
  ('Matemáticas I', 6, 1, 'C1'),
  ('Matemáticas II', 6, 1, 'C1'),
  ('Estadística e investigación operativa', 4.5, 1, 'C2'),
  ('Física II', 6, 1, 'C2'),
  ('Matemáticas III', 6, 1, 'C2'),
  ('Química general', 7.5, 1, 'C2'),
  ('Ampliación de química', 4.5, 2, 'C1'),
  ('Elasticidad y resistencia de materiales', 4.5, 2, 'C1'),
  ('Ampliación de matemáticas', 4.5, 2, 'C1'),
  ('Teoría de circuitos', 6, 2, 'C1'),
  ('Termodinámica', 6, 2, 'C1'),
  ('Fundamentos de control automático', 4.5, 2, 'C1'),
  ('Cinética y termodinámica química aplicadas', 6, 2, 'C2'),
  ('Fundamentos de ciencia de materiales', 4.5, 2, 'C2'),
  ('Fundamentos de ingeniería química', 4.5, 2, 'C2'),
  ('Mecánica de fluidos', 6, 2, 'C2'),
  ('Teoría de máquinas y mecanismos', 4.5, 2, 'C2'),
  ('Transmisión de calor', 4.5, 2, 'C2'),
  ('Análisis químico', 6, 3, 'C1'),
  ('Electrónica general', 4.5, 3, 'C1'),
  ('Tecnología energética', 4.5, 3, 'C1'),
  ('Tecnologías del medio ambiente', 4.5, 3, 'C1'),
  ('Instalaciones y máquinas eléctricas', 4.5, 3, 'C1'),
  ('Medición y control de la contaminación ambiental', 4.5, 3, 'C1'),
  ('Tecnología de combustibles', 4.5, 3, 'C1'),
  ('Operaciones básicas con sólidos y fluidos', 6, 3, 'A'),
  ('Operaciones de separación', 7.5, 3, 'A'),
  ('Experimentación en ingeniería química', 4.5, 3, 'C2'),
  ('Control e instrumentación de procesos químicos', 4.5, 3, 'C2'),
  ('Ingeniería de procesos', 4.5, 3, 'C2'),
  ('Máquinas y motores térmicos', 4.5, 3, 'C2'),
  ('Reactores químicos', 4.5, 3, 'C2'),
  ('Tecnología de materiales', 4.5, 3, 'C2'),
  ('Tratamiento de aguas', 4.5, 3, 'C2'),
  ('Análisis y prevención de riesgos laborales', 4.5, 3, 'C2'),
  ('Ingeniería fluidomecánica', 4.5, 3, 'C2'),
  ('Automatización industrial de procesos', 4.5, 4, 'C1'),
  ('Diseño asistido por ordenador', 4.5, 4, 'C1'),
  ('Gestión y tratamiento de residuos', 4.5, 4, 'C1'),
  ('Ingeniería de procesos térmicos', 4.5, 4, 'C1'),
  ('Organización y gestión de empresas', 6, 4, 'C1'),
  ('Proyecto integral de plantas industriales', 4.5, 4, 'C1'),
  ('Proyectos', 4.5, 4, 'C1'),
  ('Reactores heterogéneos', 6, 4, 'C1'),
  ('Tecnología de fabricación', 4.5, 4, 'C1'),
  ('Tecnología química', 4.5, 4, 'C1'),
  ('Teoría de estructuras', 4.5, 4, 'C1'),
  ('Simulación y optimización de procesos químicos', 4.5, 4, 'C2'),
  ('Tratamiento de efluentes gaseosos', 4.5, 4, 'C1'),
  ('Bioingeniería', 4.5, 4, 'C2'),
  ('Ingeniería de plantas químicas', 4.5, 4, 'C2'),
  ('Matemática computacional', 4.5, 4, 'C2'),
  ('Metodología e historia de la ingeniería', 4.5, 4, 'C2'),
  ('Óptica aplicada', 4.5, 4, 'C2')
) as v(nombre, creditos, anio, cuatrimestre) on true
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería Química')
on conflict (carrera_id, nombre_normalizado) do nothing;

-- ---------- Grado en Ingeniería de Organización Industrial ----------

insert into public.carreras_canonicas (nombre, universidad_id, estado, origen)
select 'Grado en Ingeniería de Organización Industrial', u.id, 'aprobada', 'seed'
from public.universidades_canonicas u
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
on conflict (universidad_id, nombre_normalizado) do nothing;

insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, anio, cuatrimestre, estado, origen)
select v.nombre, c.id, v.creditos, v.anio, v.cuatrimestre, 'aprobada', 'seed'
from public.carreras_canonicas c
join public.universidades_canonicas u on u.id = c.universidad_id
join (values
  ('Física I', 6, 1, 'C1'),
  ('Informática', 6, 1, 'C1'),
  ('Matemáticas I', 6, 1, 'C1'),
  ('Matemáticas II', 6, 1, 'C1'),
  ('Química', 6, 1, 'C1'),
  ('Empresa', 6, 1, 'C2'),
  ('Estadística e investigación operativa', 6, 1, 'C2'),
  ('Expresión gráfica', 6, 1, 'C2'),
  ('Física II', 6, 1, 'C2'),
  ('Matemáticas III', 6, 1, 'C2'),
  ('Gestión de empresas', 6, 2, 'C1'),
  ('Ingeniería térmica', 6, 2, 'C1'),
  ('Métodos cuantitativos de investigación operativa', 6, 2, 'C1'),
  ('Tecnología de materiales y máquinas', 6, 2, 'C1'),
  ('Tecnología eléctrica', 6, 2, 'C1'),
  ('Control automático y de procesos', 6, 2, 'C2'),
  ('Sistemas de producción', 9, 2, 'C2'),
  ('Tecnología electrónica', 4.5, 2, 'C2'),
  ('Tecnología química y ambiental', 6, 2, 'C2'),
  ('Tecnología y máquinas hidráulicas', 4.5, 2, 'C2'),
  ('Gestión de calidad', 6, 3, 'C1'),
  ('Mercados', 4.5, 3, 'C1'),
  ('Métodos cuantitativos de gestión', 4.5, 3, 'C1'),
  ('Seguridad laboral e industrial', 4.5, 3, 'C1'),
  ('Sistemas de información', 4.5, 3, 'C1'),
  ('Tecnologías de fabricación', 6, 3, 'C1'),
  ('Creación de empresas', 4.5, 3, 'C2'),
  ('Diseño de productos e innovación', 4.5, 3, 'C2'),
  ('Factor humano de las organizaciones', 6, 3, 'C2'),
  ('Gestión de proyectos', 4.5, 3, 'C2'),
  ('Modelado y simulación de sistemas industriales', 4.5, 3, 'C2'),
  ('Sistemas de gestión del mantenimiento', 6, 3, 'C2'),
  ('Fiabilidad industrial', 4.5, 4, 'C1'),
  ('Métodos de optimización', 6, 4, 'C1'),
  ('Programación y control de la producción', 6, 4, 'C1'),
  ('Reingeniería de procesos', 4.5, 4, 'C1'),
  ('Sistemas de gestión empresarial', 4.5, 4, 'C1'),
  ('Sistemas integrados de producción', 4.5, 4, 'C1'),
  ('Diseño asistido por ordenador', 4.5, 4, 'C1'),
  ('Informatica industrial', 4.5, 4, 'C1'),
  ('Análisis y prevención de riesgos laborales', 4.5, 4, 'C2'),
  ('Automatización y robótica industrial', 4.5, 4, 'C2'),
  ('Complejos industriales', 4.5, 4, 'C2'),
  ('Diagnóstico y control de gestión', 4.5, 4, 'C2'),
  ('Electrónica de consumo', 4.5, 4, 'C2'),
  ('Fiscalidad y gestión empresarial', 4.5, 4, 'C2'),
  ('Introducción a Matlab', 4.5, 4, 'C2'),
  ('Metodología e historia de la ingeniería', 6, 4, 'C2'),
  ('Metrología industrial', 4.5, 4, 'C2'),
  ('Óptica aplicada', 4.5, 4, 'C2')
) as v(nombre, creditos, anio, cuatrimestre) on true
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería de Organización Industrial')
on conflict (carrera_id, nombre_normalizado) do nothing;

-- ---------- Grado en Ingeniería Electrónica, Robótica y Mecatrónica ----------

insert into public.carreras_canonicas (nombre, universidad_id, estado, origen)
select 'Grado en Ingeniería Electrónica, Robótica y Mecatrónica', u.id, 'aprobada', 'seed'
from public.universidades_canonicas u
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
on conflict (universidad_id, nombre_normalizado) do nothing;

insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, anio, cuatrimestre, estado, origen)
select v.nombre, c.id, v.creditos, v.anio, v.cuatrimestre, 'aprobada', 'seed'
from public.carreras_canonicas c
join public.universidades_canonicas u on u.id = c.universidad_id
join (values
  ('Física I', 6, 1, 'C1'),
  ('Informática', 6, 1, 'A'),
  ('Matemáticas I', 6, 1, 'C1'),
  ('Matemáticas II', 6, 1, 'C1'),
  ('Química', 6, 1, 'C1'),
  ('Empresa', 6, 1, 'C2'),
  ('Estadística e investigación operativa', 6, 1, 'C2'),
  ('Expresión gráfica', 6, 1, 'A'),
  ('Física II', 6, 1, 'C2'),
  ('Matemáticas III', 6, 1, 'C2'),
  ('Ampliación de matemáticas', 6, 2, 'C1'),
  ('Fundamentos de computadores', 6, 2, 'C1'),
  ('Fundamentos de electrónica', 6, 2, 'C1'),
  ('Resistencia de materiales', 6, 2, 'C1'),
  ('Teoría de circuitos', 6, 2, 'C1'),
  ('Automatización industrial', 6, 2, 'C2'),
  ('Electrónica digital', 6, 2, 'C2'),
  ('Electrónica general', 6, 2, 'C2'),
  ('Fundamentos de control', 6, 2, 'C2'),
  ('Teoría de máquinas y mecanismos', 6, 2, 'C2'),
  ('Control por computador', 6, 3, 'C1'),
  ('Ingeniería hidráulica', 4.5, 3, 'C1'),
  ('Ingeniería térmica', 4.5, 3, 'C1'),
  ('Instalaciones y máquinas eléctricas', 6, 3, 'C1'),
  ('Procesamiento digital de señal', 4.5, 3, 'C1'),
  ('Sistemas electrónicos', 4.5, 3, 'C1'),
  ('Arquitectura de redes', 4.5, 3, 'C2'),
  ('Electrónica de potencia', 4.5, 3, 'C2'),
  ('Fundamentos de robótica', 6, 3, 'C2'),
  ('Instrumentación electrónica', 6, 3, 'C2'),
  ('Organización de empresas', 4.5, 3, 'C2'),
  ('Proyectos integrados', 4.5, 3, 'C2'),
  ('Acondicionamiento de señal y conversión AD', 4.5, 4, 'C1'),
  ('Ampliación de instrumentación electrónica', 6, 4, 'C1'),
  ('Automatización de sistemas de producción (RA)', 4.5, 4, 'C1'),
  ('Control de procesos industriales (IEC)', 4.5, 4, 'C1'),
  ('Control y programación de robots (RA)', 6, 4, 'C1'),
  ('Diseño de circuitos y sistemas electrónicos (IEC)', 6, 4, 'C1'),
  ('Informática industrial (RA)', 6, 4, 'C1'),
  ('Laboratorio de diseño de circuitos y sistemas electrónicos (IEC)', 4.5, 4, 'C1'),
  ('Laboratorio de instrumentación electrónica (IEC)', 4.5, 4, 'C1'),
  ('Laboratorio de robótica (RA)', 4.5, 4, 'C1'),
  ('Sistemas de percepción (RA)', 4.5, 4, 'C1'),
  ('Sistemas electrónicos para automatización (RA)', 4.5, 4, 'C1'),
  ('Ampliación de robótica', 4.5, 4, 'C2'),
  ('Electrónica y control de sistemas de energía (ECSE)', 4.5, 4, 'C2'),
  ('Instrumentación electrónica y control (IEC)', 4.5, 4, 'C2'),
  ('Instrumentación y acondicionamiento de señal (RE)', 4.5, 4, 'C2'),
  ('Laboratorio de control de procesos (IEC)', 4.5, 4, 'C2'),
  ('Optoelectrónica (IEC)', 4.5, 4, 'C2'),
  ('Robótica y automatización (RA)', 4.5, 4, 'C2')
) as v(nombre, creditos, anio, cuatrimestre) on true
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería Electrónica, Robótica y Mecatrónica')
on conflict (carrera_id, nombre_normalizado) do nothing;

-- ---------- Grado en Ingeniería de la Energía ----------

insert into public.carreras_canonicas (nombre, universidad_id, estado, origen)
select 'Grado en Ingeniería de la Energía', u.id, 'aprobada', 'seed'
from public.universidades_canonicas u
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
on conflict (universidad_id, nombre_normalizado) do nothing;

insert into public.asignaturas_canonicas (nombre_oficial, carrera_id, creditos, anio, cuatrimestre, estado, origen)
select v.nombre, c.id, v.creditos, v.anio, v.cuatrimestre, 'aprobada', 'seed'
from public.carreras_canonicas c
join public.universidades_canonicas u on u.id = c.universidad_id
join (values
  ('Física I', 6, 1, 'C1'),
  ('Informática', 6, 1, 'C1'),
  ('Matemáticas I', 6, 1, 'C1'),
  ('Matemáticas II', 6, 1, 'C1'),
  ('Química', 6, 1, 'C1'),
  ('Empresa', 6, 1, 'C2'),
  ('Estadística e investigación operativa', 6, 1, 'C2'),
  ('Expresión gráfica', 6, 1, 'C2'),
  ('Física II', 6, 1, 'C2'),
  ('Matemáticas III', 6, 1, 'C2'),
  ('Electrónica', 6, 2, 'C1'),
  ('Fundamentos de control automático', 6, 2, 'C1'),
  ('Recursos energéticos y tecnología de los combustibles', 6, 2, 'C1'),
  ('Teoría de circuitos', 6, 2, 'C1'),
  ('Termodinámica', 6, 2, 'C1'),
  ('Ampliación de matémáticas y métodos numéricos', 4.5, 2, 'C2'),
  ('Ciencia de los materiales', 4.5, 2, 'C2'),
  ('Mecánica de fluidos', 6, 2, 'C2'),
  ('Resistencia de materiales', 4.5, 2, 'C2'),
  ('Termodinámica aplicada', 4.5, 2, 'C2'),
  ('Transmisión de calor', 6, 2, 'C2'),
  ('Instalaciones y máquinas eléctricas', 7.5, 3, 'C1'),
  ('Instalaciones y máquinas hidraúlicas', 4.5, 3, 'C1'),
  ('Máquinas térmicas', 4.5, 3, 'C1'),
  ('Tecnología de la combustión', 4.5, 3, 'C1'),
  ('Tecnología del medio ambiente', 4.5, 3, 'C1'),
  ('Tecnología energética', 4.5, 3, 'C1'),
  ('Ahorro y eficiencia energética', 4.5, 3, 'C2'),
  ('Energías renovables', 4.5, 3, 'C2'),
  ('Instalaciones térmicas', 6, 3, 'C2'),
  ('Organización y gestión de empresas', 4.5, 3, 'C2'),
  ('Proyectos', 4.5, 3, 'C2'),
  ('Sistemas de energía eléctrica', 6, 3, 'C2'),
  ('Sistemas de producción de potencia', 4.5, 3, 'C2'),
  ('Integración de energías renovables (ER)', 4.5, 4, 'C1'),
  ('Ahorro en demanda energética', 6, 4, 'C1'),
  ('Ahorro y eficiencia en instalaciones y máquinas eléctricas', 4.5, 4, 'C1'),
  ('Centrales solares (ER)', 6, 4, 'C1'),
  ('Cogeneración (SPP)', 4.5, 4, 'C1'),
  ('Eficiencia energética en instalaciones térmicas en la edificación (AEE)', 6, 4, 'C1'),
  ('Eficiencia energética en sectores industriales (AEE)', 4.5, 4, 'C1'),
  ('Energía eólica (ER)', 4.5, 4, 'C1'),
  ('Energía hidráulica y marina (ER)', 4.5, 4, 'C1'),
  ('Energía solar en la edificación (ER)', 6, 4, 'C1'),
  ('Instalaciones fotovoltaicas (ER)', 4.5, 4, 'C1'),
  ('Motores de combustión interna alternativas (SPP)', 4.5, 4, 'C1'),
  ('Plantas de potencia de vapor (SPP)', 6, 4, 'C1'),
  ('Reglamentación y certificación energética (AEE)', 4.5, 4, 'C1'),
  ('Sistemas eléctricos en plantas de potencia (SPP)', 4.5, 4, 'C1'),
  ('Sistemas electrónicos de conversión de potencia (AEE)(ER)', 4.5, 4, 'C1'),
  ('Termoeconomía de sistemas energéticos (AEE)', 4.5, 4, 'C1'),
  ('Turbina de gas y ciclos combinados (SPP)', 6, 4, 'C1'),
  ('Centrales hidraúlicas (SPP)', 4.5, 4, 'C2'),
  ('Turbomáquinas térmicas (SPP)', 4.5, 4, 'C2'),
  ('Control en sistemas energéticos', 4.5, 4, 'C2'),
  ('Sistemas basados en el hidrógeno', 4.5, 4, 'C2'),
  ('Tecnología nuclear', 4.5, 4, 'C2'),
  ('Análisis y prevención de riesgos laborales', 4.5, 4, 'C2'),
  ('Metodología e historia de la ingeniería', 4.5, 4, 'C2')
) as v(nombre, creditos, anio, cuatrimestre) on true
where u.nombre_normalizado = public.normalizar_texto('Universidad de Sevilla')
  and c.nombre_normalizado = public.normalizar_texto('Grado en Ingeniería de la Energía')
on conflict (carrera_id, nombre_normalizado) do nothing;
