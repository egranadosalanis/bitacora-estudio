/* ------------------------------------------------------------------ */
/*  DOMINIO: fechas, esquema de datos, migración y cálculos derivados  */
/*  (sin dependencias de React — reutilizable y testeable a mano)      */
/* ------------------------------------------------------------------ */

export const PALETTE = ["#4FD8EA", "#F5A623", "#3DDC84", "#A78BFA", "#FB923C", "#2DD4BF", "#FF8FB3", "#8DA3F0"];

const RAW_ENTRIES = {"2025-10-20":{"Motori per l'aeromobili":55},"2025-10-22":{"Motori per l'aeromobili":103},"2025-10-27":{"Motori per l'aeromobili":40},"2025-10-29":{"Motori per l'aeromobili":90},"2025-11-03":{"Motori per l'aeromobili":20},"2025-11-04":{"Motori per l'aeromobili":60},"2025-11-09":{"Spaceflight Mechanics":75},"2025-11-10":{"Spaceflight Mechanics":30},"2025-11-11":{"Spaceflight Mechanics":145},"2025-11-12":{"Spaceflight Mechanics":75},"2025-11-18":{"Spaceflight Mechanics":88},"2025-11-21":{"Spaceflight Mechanics":126},"2025-11-27":{"Calcolo Numerico":130},"2025-11-28":{"Calcolo Numerico":55},"2025-12-01":{"Calcolo Numerico":143,"Spaceflight Mechanics":125},"2025-12-02":{"Spaceflight Mechanics":25},"2025-12-03":{"Spaceflight Mechanics":215},"2025-12-04":{"Calcolo Numerico":110},"2025-12-05":{"Calcolo Numerico":163},"2025-12-06":{"Calcolo Numerico":60},"2025-12-07":{"Spaceflight Mechanics":225},"2025-12-08":{"Calcolo Numerico":30,"Spaceflight Mechanics":75},"2025-12-09":{"Calcolo Numerico":85},"2025-12-11":{"Calcolo Numerico":40},"2025-12-29":{"Calcolo Numerico":120},"2026-01-09":{"Spaceflight Mechanics":70},"2026-01-10":{"Calcolo Numerico":45,"Spaceflight Mechanics":120},"2026-01-11":{"Calcolo Numerico":120,"Spaceflight Mechanics":70},"2026-01-12":{"Spaceflight Mechanics":285},"2026-01-13":{"Calcolo Numerico":127,"Spaceflight Mechanics":80},"2026-01-14":{"Spaceflight Mechanics":50},"2026-01-15":{"Calcolo Numerico":125,"Spaceflight Mechanics":105},"2026-01-16":{"Spaceflight Mechanics":285},"2026-01-19":{"Calcolo Numerico":165},"2026-01-20":{"Calcolo Numerico":60,"Spaceflight Mechanics":80},"2026-01-21":{"Calcolo Numerico":70,"Spaceflight Mechanics":217},"2026-01-22":{"Calcolo Numerico":110},"2026-01-23":{"Calcolo Numerico":140,"Spaceflight Mechanics":175},"2026-01-24":{"Calcolo Numerico":60,"Spaceflight Mechanics":80},"2026-01-25":{"Spaceflight Mechanics":182},"2026-01-26":{"Calcolo Numerico":178},"2026-01-27":{"Calcolo Numerico":265},"2026-01-28":{"Calcolo Numerico":140},"2026-02-01":{"Motori per l'aeromobili":164},"2026-02-04":{"Motori per l'aeromobili":225},"2026-02-05":{"Motori per l'aeromobili":135},"2026-02-06":{"Motori per l'aeromobili":50},"2026-02-07":{"Motori per l'aeromobili":235},"2026-02-08":{"Motori per l'aeromobili":220},"2026-02-09":{"Motori per l'aeromobili":105},"2026-02-10":{"Motori per l'aeromobili":150},"2026-02-11":{"Motori per l'aeromobili":100},"2026-02-12":{"Motori per l'aeromobili":215},"2026-02-13":{"Motori per l'aeromobili":240},"2026-02-14":{"Motori per l'aeromobili":270},"2026-02-15":{"Motori per l'aeromobili":295},"2026-02-16":{"Motori per l'aeromobili":285},"2026-02-28":{"Meccanica del Volo":30},"2026-03-02":{"Meccanica del Volo":136},"2026-03-04":{"Meccanica del Volo":60},"2026-03-05":{"Meccanica del Volo":130},"2026-03-09":{"Meccanica del Volo":150},"2026-03-10":{"Meccanica del Volo":150},"2026-03-11":{"Meccanica del Volo":85},"2026-03-12":{"Meccanica del Volo":50},"2026-03-14":{"Meccanica del Volo":50},"2026-03-15":{"Meccanica del Volo":35},"2026-03-16":{"Meccanica del Volo":40},"2026-04-06":{"Meccanica del Volo":168},"2026-04-08":{"Meccanica del Volo":228},"2026-04-09":{"Meccanica del Volo":180},"2026-04-10":{"Meccanica del Volo":90},"2026-04-11":{"Meccanica del Volo":20},"2026-04-12":{"Meccanica del Volo":125},"2026-04-13":{"Meccanica del Volo":30},"2026-04-14":{"Meccanica del Volo":220},"2026-04-16":{"Meccanica del Volo":360},"2026-04-17":{"Meccanica del Volo":400},"2026-04-18":{"Meccanica del Volo":265},"2026-04-19":{"Meccanica del Volo":205},"2026-04-20":{"Meccanica del Volo":190},"2026-04-21":{"Meccanica del Volo":190},"2026-04-22":{"Meccanica del Volo":410},"2026-04-23":{"Meccanica del Volo":330},"2026-04-24":{"Meccanica del Volo":160},"2026-04-30":{"Spaceflight Mechanics":100},"2026-05-04":{"Spaceflight Mechanics":225,"Aerodinamica":40},"2026-05-05":{"Spaceflight Mechanics":50},"2026-05-06":{"Spaceflight Mechanics":145},"2026-05-07":{"Spaceflight Mechanics":39,"Motori per l'aeromobili":40},"2026-05-08":{"Aerospace Structures":200},"2026-05-15":{"Spaceflight Mechanics":110},"2026-05-16":{"Spaceflight Mechanics":155,"Motori per l'aeromobili":123},"2026-05-18":{"Spaceflight Mechanics":245},"2026-05-19":{"Spaceflight Mechanics":165},"2026-05-20":{"Spaceflight Mechanics":80,"Motori per l'aeromobili":150},"2026-05-21":{"Spaceflight Mechanics":130,"Motori per l'aeromobili":140},"2026-05-22":{"Spaceflight Mechanics":230},"2026-05-23":{"Spaceflight Mechanics":210},"2026-05-25":{"Spaceflight Mechanics":368},"2026-05-26":{"Spaceflight Mechanics":50,"Motori per l'aeromobili":270},"2026-05-27":{"Spaceflight Mechanics":215},"2026-05-30":{"Spaceflight Mechanics":200},"2026-05-31":{"Spaceflight Mechanics":170,"Motori per l'aeromobili":60},"2026-06-01":{"Spaceflight Mechanics":110,"Motori per l'aeromobili":135},"2026-06-02":{"Motori per l'aeromobili":314},"2026-06-03":{"Spaceflight Mechanics":263},"2026-06-04":{"Spaceflight Mechanics":235},"2026-06-05":{"Spaceflight Mechanics":40,"Motori per l'aeromobili":132},"2026-06-06":{"Spaceflight Mechanics":80,"Motori per l'aeromobili":382},"2026-06-07":{"Spaceflight Mechanics":130},"2026-06-08":{"Spaceflight Mechanics":60,"Motori per l'aeromobili":110},"2026-06-09":{"Aerospace Structures":170},"2026-06-11":{"Motori per l'aeromobili":118},"2026-06-12":{"Motori per l'aeromobili":295},"2026-06-13":{"Motori per l'aeromobili":344},"2026-06-14":{"Motori per l'aeromobili":442,"Aerodinamica":60},"2026-06-15":{"Motori per l'aeromobili":140},"2026-06-16":{"Motori per l'aeromobili":30},"2026-06-17":{"Aerodinamica":351},"2026-06-18":{"Aerodinamica":395},"2026-06-19":{"Aerodinamica":240}};

const DEFAULT_SUBJECT_DEFS = [
  { name: "Calcolo Numerico", credits: 6 },
  { name: "Meccanica del Volo", credits: 12 },
  { name: "Aerospace Structures", credits: 12 },
  { name: "Spaceflight Mechanics", credits: 12 },
  { name: "Motori per l'aeromobili", credits: 12 },
  { name: "Aerodinamica", credits: 12 },
];

/* ------------------------------------------------------------------ */
/*  IMPORTACIÓN HISTÓRICA (cursos 2022-2025, ver applyHistoricalImport)  */
/*  Generada a partir de 5 Excel de horas de estudio + el expediente     */
/*  académico oficial (créditos y notas reales). Cada asignatura ya      */
/*  aprobada trae su nota y nº de cursos necesarios; el resto se calcula */
/*  con freezeApproval al aplicar la importación, igual que si el        */
/*  usuario las hubiera marcado aprobada a mano.                         */
/* ------------------------------------------------------------------ */

const HISTORICAL_IMPORT_SUBJECT_DEFS = [{"name":"Matemáticas I","credits":6,"nota":6,"estado":"aprobada","cursosNecesarios":1},{"name":"Informática","credits":6,"nota":6,"estado":"aprobada","cursosNecesarios":1},{"name":"Química General","credits":6,"nota":8,"estado":"aprobada","cursosNecesarios":1},{"name":"Expresión Gráfica","credits":6,"nota":7,"estado":"aprobada","cursosNecesarios":1},{"name":"Matemáticas III","credits":6,"nota":7,"estado":"aprobada","cursosNecesarios":1},{"name":"Física II","credits":6,"nota":5,"estado":"aprobada","cursosNecesarios":1},{"name":"Control Automático","credits":4.5,"nota":6,"estado":"aprobada","cursosNecesarios":2},{"name":"Tecnología de Fabricación","credits":4.5,"nota":7.5,"estado":"aprobada","cursosNecesarios":2},{"name":"Elasticidad y Resistencia de Materiales","credits":6,"nota":6.9,"estado":"aprobada","cursosNecesarios":2},{"name":"Métodos Matemáticos","credits":4.5,"nota":9,"estado":"aprobada","cursosNecesarios":3},{"name":"Estadística e Investigación Operativa","credits":4.5,"nota":6.8,"estado":"aprobada","cursosNecesarios":1},{"name":"Mecánica de Fluidos I","credits":6,"nota":5,"estado":"aprobada","cursosNecesarios":1},{"name":"Electrotecnia","credits":6,"nota":6.4,"estado":"aprobada","cursosNecesarios":1},{"name":"Ingeniería Electrónica","credits":6,"nota":9,"estado":"aprobada","cursosNecesarios":1},{"name":"Mecánica de Fluidos II","credits":4.5,"nota":5.7,"estado":"aprobada","cursosNecesarios":1},{"name":"Diseño y Fabricación Asistidos por Ordenador","credits":4.5,"nota":7.6,"estado":"aprobada","cursosNecesarios":1},{"name":"Instalaciones de Fabricación y Sistemas de Producción","credits":6,"nota":10,"estado":"aprobada","cursosNecesarios":1},{"name":"Materiales Aeroespaciales","credits":7.5,"nota":null,"estado":"en_curso","cursosNecesarios":null}];

const HISTORICAL_IMPORT_ENTRIES = {"2022-10-05":{"Matemáticas I":105},"2022-10-06":{"Matemáticas I":60},"2022-10-07":{"Informática":80,"Química General":145,"Expresión Gráfica":82},"2022-10-09":{"Matemáticas I":90},"2022-10-10":{"Matemáticas I":90,"Expresión Gráfica":86},"2022-10-11":{"Matemáticas I":368},"2022-10-12":{"Matemáticas I":23,"Expresión Gráfica":75},"2022-10-13":{"Matemáticas I":105,"Informática":161},"2022-10-14":{"Informática":171},"2022-10-18":{"Matemáticas I":260,"Informática":51},"2022-10-19":{"Matemáticas I":105,"Expresión Gráfica":75},"2022-10-20":{"Matemáticas I":144,"Expresión Gráfica":125},"2022-10-24":{"Matemáticas I":318},"2022-10-25":{"Matemáticas I":162},"2022-10-26":{"Matemáticas I":160},"2022-10-27":{"Matemáticas I":79},"2022-10-28":{"Matemáticas I":197},"2022-10-30":{"Matemáticas I":60},"2022-10-31":{"Matemáticas I":370},"2022-11-01":{"Matemáticas I":125},"2022-11-02":{"Matemáticas I":235},"2022-11-03":{"Matemáticas I":100},"2022-11-04":{"Matemáticas I":165},"2022-11-05":{"Matemáticas I":210},"2022-11-10":{"Matemáticas I":60},"2022-11-14":{"Informática":60,"Expresión Gráfica":140},"2022-11-16":{"Matemáticas I":90,"Informática":160},"2022-11-18":{"Expresión Gráfica":145},"2022-11-19":{"Informática":130},"2022-11-21":{"Matemáticas I":40},"2022-11-24":{"Matemáticas I":45},"2022-11-25":{"Matemáticas I":130},"2022-11-29":{"Informática":195},"2022-12-07":{"Matemáticas I":329},"2022-12-08":{"Matemáticas I":70},"2022-12-10":{"Matemáticas I":228},"2022-12-12":{"Matemáticas I":170,"Informática":60},"2022-12-13":{"Matemáticas I":283},"2022-12-14":{"Matemáticas I":242},"2022-12-15":{"Matemáticas I":90},"2022-12-16":{"Matemáticas I":301},"2022-12-17":{"Matemáticas I":195},"2022-12-18":{"Matemáticas I":240},"2022-12-19":{"Matemáticas I":208},"2022-12-20":{"Matemáticas I":340},"2022-12-26":{"Informática":60},"2022-12-27":{"Informática":230},"2022-12-28":{"Informática":225},"2022-12-29":{"Informática":160},"2023-01-01":{"Informática":50},"2023-01-02":{"Informática":157},"2023-01-03":{"Informática":60},"2023-01-04":{"Expresión Gráfica":244},"2023-01-07":{"Informática":120},"2023-01-08":{"Informática":270},"2023-01-09":{"Expresión Gráfica":270},"2023-01-10":{"Expresión Gráfica":275},"2023-01-11":{"Expresión Gráfica":150},"2023-01-30":{"Matemáticas III":45,"Química General":145},"2023-01-31":{"Química General":113},"2023-02-01":{"Matemáticas III":86,"Expresión Gráfica":60},"2023-02-02":{"Expresión Gráfica":30},"2023-02-03":{"Matemáticas III":70,"Expresión Gráfica":75},"2023-02-06":{"Matemáticas III":235},"2023-02-07":{"Expresión Gráfica":105},"2023-02-08":{"Química General":110},"2023-02-09":{"Matemáticas III":105,"Física II":105},"2023-02-13":{"Expresión Gráfica":170},"2023-02-14":{"Expresión Gráfica":33},"2023-02-15":{"Matemáticas III":170,"Física II":75},"2023-02-16":{"Matemáticas III":105,"Física II":180},"2023-02-17":{"Química General":90,"Informática":105},"2023-02-19":{"Química General":175},"2023-02-20":{"Química General":35,"Expresión Gráfica":265},"2023-02-21":{"Química General":30,"Expresión Gráfica":135},"2023-02-22":{"Física II":70},"2023-02-23":{"Matemáticas III":135,"Física II":105,"Informática":157},"2023-02-24":{"Informática":105},"2023-02-26":{"Expresión Gráfica":60},"2023-02-28":{"Expresión Gráfica":45},"2023-03-01":{"Física II":60,"Expresión Gráfica":235},"2023-03-02":{"Matemáticas III":105,"Física II":105,"Informática":156},"2023-03-03":{"Matemáticas III":212,"Informática":105},"2023-03-06":{"Expresión Gráfica":294},"2023-03-07":{"Matemáticas III":30},"2023-03-08":{"Matemáticas III":246,"Física II":50,"Expresión Gráfica":50},"2023-03-09":{"Física II":55},"2023-03-14":{"Expresión Gráfica":220},"2023-03-15":{"Matemáticas III":250},"2023-03-16":{"Matemáticas III":105,"Física II":170},"2023-03-17":{"Matemáticas III":110},"2023-03-18":{"Matemáticas III":120},"2023-03-19":{"Matemáticas III":273},"2023-03-20":{"Matemáticas III":215},"2023-03-21":{"Matemáticas III":210},"2023-03-22":{"Matemáticas III":112},"2023-03-23":{"Matemáticas III":200},"2023-03-24":{"Matemáticas III":185},"2023-03-25":{"Matemáticas III":285},"2023-03-26":{"Matemáticas III":166},"2023-03-27":{"Matemáticas III":350},"2023-03-28":{"Matemáticas III":200},"2023-04-04":{"Física II":150},"2023-04-05":{"Física II":220},"2023-04-06":{"Física II":240},"2023-04-07":{"Física II":40},"2023-04-08":{"Física II":110},"2023-04-09":{"Física II":170},"2023-04-10":{"Química General":70},"2023-04-11":{"Química General":240},"2023-04-12":{"Física II":30,"Química General":280},"2024-02-07":{"Estadística e Investigación Operativa":242},"2024-02-08":{"Electrotecnia":221},"2024-02-09":{"Elasticidad y Resistencia de Materiales":90},"2024-02-13":{"Mecánica de Fluidos I":60,"Métodos Matemáticos":177},"2024-02-14":{"Estadística e Investigación Operativa":250,"Mecánica de Fluidos I":70},"2024-02-15":{"Estadística e Investigación Operativa":105,"Mecánica de Fluidos I":105,"Elasticidad y Resistencia de Materiales":120},"2024-02-19":{"Tecnología de Fabricación":30,"Métodos Matemáticos":217},"2024-02-20":{"Mecánica de Fluidos I":130},"2024-02-21":{"Estadística e Investigación Operativa":40,"Mecánica de Fluidos I":105},"2024-02-22":{"Estadística e Investigación Operativa":105,"Métodos Matemáticos":105},"2024-02-23":{"Elasticidad y Resistencia de Materiales":90},"2024-02-25":{"Métodos Matemáticos":100},"2024-02-26":{"Métodos Matemáticos":85,"Electrotecnia":70},"2024-02-27":{"Electrotecnia":65},"2024-02-29":{"Estadística e Investigación Operativa":35,"Mecánica de Fluidos I":183,"Elasticidad y Resistencia de Materiales":60},"2024-03-04":{"Estadística e Investigación Operativa":50,"Tecnología de Fabricación":55,"Mecánica de Fluidos I":110},"2024-03-05":{"Estadística e Investigación Operativa":175,"Métodos Matemáticos":120},"2024-03-11":{"Estadística e Investigación Operativa":165,"Tecnología de Fabricación":60,"Mecánica de Fluidos I":125},"2024-03-12":{"Control Automático":60,"Métodos Matemáticos":205},"2024-03-13":{"Métodos Matemáticos":40,"Electrotecnia":180},"2024-03-14":{"Tecnología de Fabricación":90},"2024-03-15":{"Control Automático":215},"2024-03-16":{"Electrotecnia":80},"2024-03-18":{"Estadística e Investigación Operativa":80,"Tecnología de Fabricación":50,"Mecánica de Fluidos I":100},"2024-03-19":{"Control Automático":63,"Métodos Matemáticos":110,"Electrotecnia":40},"2024-03-21":{"Mecánica de Fluidos I":160},"2024-03-22":{"Tecnología de Fabricación":42,"Mecánica de Fluidos I":15},"2024-03-25":{"Mecánica de Fluidos I":120},"2024-03-28":{"Mecánica de Fluidos I":70},"2024-03-29":{"Mecánica de Fluidos I":88},"2024-03-30":{"Estadística e Investigación Operativa":100},"2024-03-31":{"Estadística e Investigación Operativa":20},"2024-04-01":{"Estadística e Investigación Operativa":135,"Métodos Matemáticos":187},"2024-04-02":{"Métodos Matemáticos":142},"2024-04-03":{"Mecánica de Fluidos I":165},"2024-04-04":{"Mecánica de Fluidos I":85},"2024-04-08":{"Estadística e Investigación Operativa":220,"Control Automático":45,"Mecánica de Fluidos I":146},"2024-04-09":{"Mecánica de Fluidos I":150,"Métodos Matemáticos":30},"2024-04-10":{"Métodos Matemáticos":205},"2024-04-11":{"Control Automático":90},"2024-04-12":{"Electrotecnia":60},"2024-04-16":{"Mecánica de Fluidos I":157},"2024-04-17":{"Electrotecnia":256},"2024-04-18":{"Mecánica de Fluidos I":120,"Métodos Matemáticos":115},"2024-04-19":{"Electrotecnia":120},"2024-04-22":{"Control Automático":60,"Métodos Matemáticos":150},"2024-04-23":{"Métodos Matemáticos":90},"2024-04-24":{"Mecánica de Fluidos I":15,"Métodos Matemáticos":70},"2024-04-25":{"Mecánica de Fluidos I":120},"2024-04-26":{"Electrotecnia":60},"2024-04-27":{"Electrotecnia":65},"2024-04-28":{"Electrotecnia":300},"2024-04-29":{"Métodos Matemáticos":150,"Electrotecnia":110},"2024-04-30":{"Métodos Matemáticos":177},"2024-05-01":{"Electrotecnia":140},"2024-05-03":{"Estadística e Investigación Operativa":120,"Electrotecnia":140},"2024-05-04":{"Mecánica de Fluidos I":60},"2024-05-05":{"Mecánica de Fluidos I":57},"2024-05-06":{"Electrotecnia":128},"2024-05-07":{"Métodos Matemáticos":90,"Electrotecnia":260},"2024-05-09":{"Estadística e Investigación Operativa":15,"Electrotecnia":165},"2024-05-10":{"Electrotecnia":270},"2024-05-11":{"Estadística e Investigación Operativa":230,"Electrotecnia":100},"2024-05-12":{"Electrotecnia":150},"2024-05-13":{"Estadística e Investigación Operativa":60,"Electrotecnia":244},"2024-05-14":{"Estadística e Investigación Operativa":60,"Electrotecnia":230},"2024-05-15":{"Electrotecnia":383},"2024-05-16":{"Electrotecnia":240},"2024-05-17":{"Estadística e Investigación Operativa":250},"2024-05-18":{"Estadística e Investigación Operativa":345},"2024-05-19":{"Estadística e Investigación Operativa":160},"2024-05-21":{"Estadística e Investigación Operativa":300},"2024-05-22":{"Estadística e Investigación Operativa":240},"2024-05-25":{"Métodos Matemáticos":240},"2024-05-26":{"Métodos Matemáticos":330},"2024-05-28":{"Mecánica de Fluidos I":40},"2024-05-29":{"Métodos Matemáticos":150},"2024-05-30":{"Mecánica de Fluidos I":245,"Elasticidad y Resistencia de Materiales":70},"2024-05-31":{"Mecánica de Fluidos I":60,"Elasticidad y Resistencia de Materiales":140},"2024-06-02":{"Mecánica de Fluidos I":90},"2024-06-04":{"Mecánica de Fluidos I":165},"2024-06-05":{"Mecánica de Fluidos I":265},"2024-06-06":{"Mecánica de Fluidos I":60},"2024-06-07":{"Mecánica de Fluidos I":455},"2024-06-08":{"Mecánica de Fluidos I":240},"2024-06-09":{"Mecánica de Fluidos I":60},"2024-06-10":{"Mecánica de Fluidos I":266},"2024-06-11":{"Mecánica de Fluidos I":120},"2024-06-14":{"Elasticidad y Resistencia de Materiales":270},"2024-06-15":{"Elasticidad y Resistencia de Materiales":10},"2024-06-16":{"Elasticidad y Resistencia de Materiales":212},"2024-06-18":{"Elasticidad y Resistencia de Materiales":230},"2024-06-20":{"Elasticidad y Resistencia de Materiales":386},"2024-06-21":{"Métodos Matemáticos":170,"Elasticidad y Resistencia de Materiales":103},"2024-06-22":{"Métodos Matemáticos":150,"Elasticidad y Resistencia de Materiales":82},"2024-06-23":{"Métodos Matemáticos":80,"Elasticidad y Resistencia de Materiales":335},"2024-06-24":{"Métodos Matemáticos":114},"2024-06-25":{"Métodos Matemáticos":60},"2024-06-27":{"Métodos Matemáticos":30},"2024-09-21":{"Diseño y Fabricación Asistidos por Ordenador":40,"Materiales Aeroespaciales":43},"2024-09-24":{"Mecánica de Fluidos II":109},"2024-09-25":{"Mecánica de Fluidos II":37,"Diseño y Fabricación Asistidos por Ordenador":50},"2024-09-26":{"Mecánica de Fluidos II":15},"2024-09-30":{"Mecánica de Fluidos II":97,"Materiales Aeroespaciales":157},"2024-10-02":{"Diseño y Fabricación Asistidos por Ordenador":45,"Elasticidad y Resistencia de Materiales":60},"2024-10-04":{"Ingeniería Electrónica":28},"2024-10-07":{"Ingeniería Electrónica":50,"Mecánica de Fluidos II":168,"Elasticidad y Resistencia de Materiales":63},"2024-10-08":{"Ingeniería Electrónica":28},"2024-10-09":{"Ingeniería Electrónica":10,"Diseño y Fabricación Asistidos por Ordenador":59},"2024-10-10":{"Ingeniería Electrónica":187,"Mecánica de Fluidos II":30},"2024-10-12":{"Elasticidad y Resistencia de Materiales":75},"2024-10-13":{"Elasticidad y Resistencia de Materiales":128},"2024-10-14":{"Mecánica de Fluidos II":62,"Elasticidad y Resistencia de Materiales":150},"2024-10-16":{"Diseño y Fabricación Asistidos por Ordenador":16},"2024-10-18":{"Mecánica de Fluidos II":155},"2024-10-19":{"Mecánica de Fluidos II":105,"Elasticidad y Resistencia de Materiales":25},"2024-10-21":{"Elasticidad y Resistencia de Materiales":30},"2024-10-22":{"Mecánica de Fluidos II":90,"Elasticidad y Resistencia de Materiales":79},"2024-10-24":{"Mecánica de Fluidos II":60,"Elasticidad y Resistencia de Materiales":156},"2024-10-26":{"Elasticidad y Resistencia de Materiales":105},"2024-10-28":{"Elasticidad y Resistencia de Materiales":240},"2024-10-29":{"Elasticidad y Resistencia de Materiales":121},"2024-10-30":{"Elasticidad y Resistencia de Materiales":175},"2024-10-31":{"Elasticidad y Resistencia de Materiales":390},"2024-11-01":{"Elasticidad y Resistencia de Materiales":423},"2024-11-04":{"Mecánica de Fluidos II":350},"2024-11-05":{"Mecánica de Fluidos II":200},"2024-11-06":{"Mecánica de Fluidos II":60},"2024-11-08":{"Diseño y Fabricación Asistidos por Ordenador":85,"Materiales Aeroespaciales":30},"2024-11-10":{"Materiales Aeroespaciales":133},"2024-11-12":{"Elasticidad y Resistencia de Materiales":5,"Materiales Aeroespaciales":75},"2024-11-13":{"Materiales Aeroespaciales":235},"2024-11-14":{"Materiales Aeroespaciales":337},"2024-11-15":{"Materiales Aeroespaciales":115},"2024-11-16":{"Materiales Aeroespaciales":80},"2024-11-17":{"Materiales Aeroespaciales":130},"2024-11-18":{"Materiales Aeroespaciales":256},"2024-11-19":{"Materiales Aeroespaciales":60},"2024-11-20":{"Materiales Aeroespaciales":291},"2024-11-21":{"Materiales Aeroespaciales":100},"2024-11-25":{"Elasticidad y Resistencia de Materiales":70},"2024-11-26":{"Elasticidad y Resistencia de Materiales":185},"2024-11-30":{"Elasticidad y Resistencia de Materiales":138},"2024-12-02":{"Mecánica de Fluidos II":95,"Elasticidad y Resistencia de Materiales":140},"2024-12-03":{"Mecánica de Fluidos II":18},"2024-12-04":{"Mecánica de Fluidos II":50,"Elasticidad y Resistencia de Materiales":160},"2024-12-05":{"Mecánica de Fluidos II":60},"2024-12-06":{"Mecánica de Fluidos II":103},"2024-12-07":{"Elasticidad y Resistencia de Materiales":90},"2024-12-10":{"Mecánica de Fluidos II":140,"Elasticidad y Resistencia de Materiales":100},"2024-12-11":{"Mecánica de Fluidos II":100,"Elasticidad y Resistencia de Materiales":120},"2024-12-12":{"Elasticidad y Resistencia de Materiales":120},"2024-12-13":{"Elasticidad y Resistencia de Materiales":90},"2024-12-14":{"Mecánica de Fluidos II":218},"2024-12-15":{"Mecánica de Fluidos II":372},"2024-12-16":{"Mecánica de Fluidos II":341},"2024-12-17":{"Elasticidad y Resistencia de Materiales":198},"2024-12-18":{"Elasticidad y Resistencia de Materiales":420},"2024-12-19":{"Elasticidad y Resistencia de Materiales":330},"2024-12-20":{"Elasticidad y Resistencia de Materiales":60},"2025-01-02":{"Ingeniería Electrónica":105},"2025-01-05":{"Ingeniería Electrónica":90},"2025-01-08":{"Ingeniería Electrónica":110},"2025-01-09":{"Ingeniería Electrónica":247},"2025-01-10":{"Diseño y Fabricación Asistidos por Ordenador":160},"2025-01-11":{"Ingeniería Electrónica":40},"2025-01-12":{"Ingeniería Electrónica":120},"2025-01-13":{"Ingeniería Electrónica":317},"2025-01-14":{"Mecánica de Fluidos II":140},"2025-01-15":{"Ingeniería Electrónica":120},"2025-01-16":{"Ingeniería Electrónica":150},"2025-01-17":{"Ingeniería Electrónica":410},"2025-01-18":{"Ingeniería Electrónica":350},"2025-01-19":{"Ingeniería Electrónica":380},"2025-01-20":{"Ingeniería Electrónica":325},"2025-01-21":{"Ingeniería Electrónica":120},"2025-02-03":{"Tecnología de Fabricación":20},"2025-02-04":{"Instalaciones de Fabricación y Sistemas de Producción":52},"2025-02-05":{"Instalaciones de Fabricación y Sistemas de Producción":50},"2025-02-10":{"Instalaciones de Fabricación y Sistemas de Producción":30,"Tecnología de Fabricación":50},"2025-02-11":{"Tecnología de Fabricación":100},"2025-02-12":{"Instalaciones de Fabricación y Sistemas de Producción":120,"Tecnología de Fabricación":45},"2025-02-16":{"Instalaciones de Fabricación y Sistemas de Producción":165},"2025-02-17":{"Instalaciones de Fabricación y Sistemas de Producción":30,"Tecnología de Fabricación":40},"2025-02-18":{"Control Automático":180},"2025-02-21":{"Instalaciones de Fabricación y Sistemas de Producción":140,"Métodos Matemáticos":140},"2025-02-24":{"Materiales Aeroespaciales":90},"2025-02-25":{"Instalaciones de Fabricación y Sistemas de Producción":60},"2025-02-26":{"Instalaciones de Fabricación y Sistemas de Producción":50},"2025-02-28":{"Instalaciones de Fabricación y Sistemas de Producción":90},"2025-03-03":{"Instalaciones de Fabricación y Sistemas de Producción":46,"Métodos Matemáticos":111,"Materiales Aeroespaciales":50},"2025-03-04":{"Tecnología de Fabricación":40},"2025-03-05":{"Instalaciones de Fabricación y Sistemas de Producción":65},"2025-03-06":{"Instalaciones de Fabricación y Sistemas de Producción":110},"2025-03-07":{"Instalaciones de Fabricación y Sistemas de Producción":245},"2025-03-09":{"Instalaciones de Fabricación y Sistemas de Producción":55},"2025-03-10":{"Instalaciones de Fabricación y Sistemas de Producción":50},"2025-03-11":{"Instalaciones de Fabricación y Sistemas de Producción":130},"2025-03-12":{"Instalaciones de Fabricación y Sistemas de Producción":155},"2025-03-17":{"Instalaciones de Fabricación y Sistemas de Producción":87},"2025-03-18":{"Instalaciones de Fabricación y Sistemas de Producción":277},"2025-03-19":{"Instalaciones de Fabricación y Sistemas de Producción":119},"2025-03-25":{"Métodos Matemáticos":75},"2025-03-26":{"Tecnología de Fabricación":55,"Métodos Matemáticos":235},"2025-03-31":{"Métodos Matemáticos":217},"2025-04-01":{"Control Automático":125,"Métodos Matemáticos":62},"2025-04-05":{"Control Automático":40},"2025-04-07":{"Instalaciones de Fabricación y Sistemas de Producción":50,"Control Automático":120},"2025-04-08":{"Instalaciones de Fabricación y Sistemas de Producción":240},"2025-04-09":{"Instalaciones de Fabricación y Sistemas de Producción":70,"Control Automático":45},"2025-04-10":{"Control Automático":30},"2025-04-12":{"Instalaciones de Fabricación y Sistemas de Producción":145,"Control Automático":20},"2025-04-13":{"Instalaciones de Fabricación y Sistemas de Producción":90},"2025-04-14":{"Instalaciones de Fabricación y Sistemas de Producción":115},"2025-04-15":{"Instalaciones de Fabricación y Sistemas de Producción":270},"2025-04-16":{"Instalaciones de Fabricación y Sistemas de Producción":115},"2025-04-17":{"Instalaciones de Fabricación y Sistemas de Producción":130},"2025-04-19":{"Instalaciones de Fabricación y Sistemas de Producción":155},"2025-04-20":{"Instalaciones de Fabricación y Sistemas de Producción":195},"2025-04-21":{"Instalaciones de Fabricación y Sistemas de Producción":241},"2025-04-22":{"Instalaciones de Fabricación y Sistemas de Producción":175},"2025-04-23":{"Instalaciones de Fabricación y Sistemas de Producción":60,"Tecnología de Fabricación":116},"2025-04-29":{"Tecnología de Fabricación":130},"2025-05-01":{"Tecnología de Fabricación":50},"2025-05-02":{"Tecnología de Fabricación":144},"2025-05-05":{"Tecnología de Fabricación":166,"Control Automático":195},"2025-05-06":{"Tecnología de Fabricación":207},"2025-05-10":{"Tecnología de Fabricación":90},"2025-05-11":{"Tecnología de Fabricación":261},"2025-05-12":{"Tecnología de Fabricación":210},"2025-05-13":{"Instalaciones de Fabricación y Sistemas de Producción":70,"Tecnología de Fabricación":289},"2025-05-14":{"Instalaciones de Fabricación y Sistemas de Producción":85,"Tecnología de Fabricación":265},"2025-05-15":{"Tecnología de Fabricación":228},"2025-05-16":{"Tecnología de Fabricación":455},"2025-05-17":{"Tecnología de Fabricación":305},"2025-05-18":{"Tecnología de Fabricación":165},"2025-05-19":{"Tecnología de Fabricación":495},"2025-05-20":{"Tecnología de Fabricación":245},"2025-05-21":{"Instalaciones de Fabricación y Sistemas de Producción":90},"2025-05-22":{"Control Automático":150},"2025-05-23":{"Control Automático":230},"2025-05-24":{"Control Automático":80},"2025-05-25":{"Control Automático":233},"2025-05-26":{"Control Automático":140},"2025-05-27":{"Control Automático":218},"2025-05-28":{"Control Automático":125},"2025-05-30":{"Control Automático":402},"2025-05-31":{"Control Automático":274},"2025-06-01":{"Control Automático":185},"2025-06-02":{"Control Automático":370},"2025-06-07":{"Ingeniería Electrónica":210},"2025-06-08":{"Ingeniería Electrónica":155},"2025-06-09":{"Ingeniería Electrónica":150},"2025-06-10":{"Ingeniería Electrónica":329},"2025-06-13":{"Ingeniería Electrónica":257},"2025-06-15":{"Ingeniería Electrónica":258},"2025-06-16":{"Ingeniería Electrónica":110},"2025-06-17":{"Ingeniería Electrónica":135},"2025-06-18":{"Ingeniería Electrónica":60},"2025-06-19":{"Ingeniería Electrónica":362},"2025-06-20":{"Ingeniería Electrónica":265},"2025-06-21":{"Ingeniería Electrónica":180},"2025-06-22":{"Ingeniería Electrónica":245},"2025-06-23":{"Ingeniería Electrónica":225},"2025-06-24":{"Ingeniería Electrónica":450},"2025-06-25":{"Ingeniería Electrónica":455}};

export function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

/* ------------------------------------------------------------------ */
/*  UTILIDADES DE FECHA                                                */
/* ------------------------------------------------------------------ */

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
export function parseISO(iso) {
  return new Date(iso + "T00:00:00");
}
export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
export function formatShort(iso) {
  const d = parseISO(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}
export function formatLong(iso) {
  const d = parseISO(iso);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
export function formatMedium(iso) {
  const d = parseISO(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}
export function hm(minutes) {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

/* ------------------------------------------------------------------ */
/*  ESQUEMA DE DATOS Y MIGRACIÓN                                       */
/*                                                                      */
/*  v3: { schemaVersion, activeCursoId,                                 */
/*        cursos: [{ id, name, startDate, endDate }],  ← solo un rango  */
/*                  de fechas, ya no "posee" asignaturas                */
/*        subjects: [{ id, name, credits, target, color,                */
/*                      estado: 'en_curso'|'suspendida'|'aprobada',     */
/*                      mergedInto: null | subjectId,  ← ver más abajo  */
/*                      frozen: null | {...} }],    ← entidad global    */
/*        entries: { [fecha]: { [subjectId]: minutos } } }  ← global    */
/*                                                                       */
/*  Cada asignatura es una entidad única y persistente con su propia     */
/*  lista de registros diarios. El "curso académico" ya no se vincula    */
/*  manualmente a las asignaturas — es solo un filtro automático por     */
/*  fecha: un registro pertenece al curso cuyo rango [startDate,endDate] */
/*  contiene su fecha. Ver subjectsWithActivityInRange/entriesInRange.   */
/*                                                                       */
/*  `mergedInto`: cuando una asignatura (p. ej. una convalidada por      */
/*  Erasmus) cuenta, a efectos de clasificación histórica, como parte    */
/*  de otra (la asignatura "oficial" a la que equivale), se marca con    */
/*  mergedInto = id de esa otra asignatura. Sigue existiendo como        */
/*  entidad independiente en Panel/Trayectoria/Bitácora/Desgaste, pero    */
/*  sus minutos se suman a los de la asignatura destino solo al calcular */
/*  horas/crédito y días totales en Clasificación histórica, y no        */
/*  aparece como fila propia allí.                                      */
/* ------------------------------------------------------------------ */

export const SCHEMA_VERSION = 3;

/** Si el nombre de un curso sigue el patrón "AAAA-AAAA" (p. ej.
 * "2025-2026"), infiere su rango como año académico español estándar:
 * 1 de septiembre del primer año al 31 de agosto del segundo. */
export function inferCursoRange(name) {
  const m = /^(\d{4})-(\d{4})$/.exec((name || "").trim());
  if (!m) return null;
  return { startDate: `${m[1]}-09-01`, endDate: `${m[2]}-08-31` };
}

export function buildDefaultData() {
  const subjects = DEFAULT_SUBJECT_DEFS.map((s, i) => ({
    id: uid("sub"),
    name: s.name,
    credits: s.credits,
    target: null,
    color: PALETTE[i % PALETTE.length],
    estado: "en_curso",
    mergedInto: null,
    originCursoId: null,
    frozen: null,
  }));
  const nameToId = Object.fromEntries(subjects.map((s) => [s.name, s.id]));
  const entries = {};
  Object.entries(RAW_ENTRIES).forEach(([date, bySubjectName]) => {
    entries[date] = {};
    Object.entries(bySubjectName).forEach(([name, minutes]) => {
      const id = nameToId[name];
      if (id) entries[date][id] = minutes;
    });
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    activeCursoId: "curso_2025_2026",
    cursos: [{ id: "curso_2025_2026", name: "2025-2026", ...inferCursoRange("2025-2026") }],
    subjects,
    entries,
  };
}

/** Convierte cualquier esquema anterior al v3 actual (global, con cursos
 * como simple rango de fechas). Idempotente. */
export function migrateData(raw) {
  if (!raw) return null;
  if (raw.schemaVersion === SCHEMA_VERSION && Array.isArray(raw.subjects) && raw.entries) {
    if (raw.subjects.every((s) => "mergedInto" in s && "originCursoId" in s) && raw.cursos.every((c) => "startDate" in c)) return raw;
    return {
      ...raw,
      subjects: raw.subjects.map((s) => ({ mergedInto: null, originCursoId: null, ...s })),
      cursos: raw.cursos.map((c) => ("startDate" in c ? c : { id: c.id, name: c.name, ...(inferCursoRange(c.name) || fallbackCursoRange(c, raw)) })),
    };
  }

  // v2 (subjectIds por curso) o esquema original (subjects/entries anidados
  // en cada curso): en ambos casos, primero recolectamos subjects/entries
  // a nivel global igual que antes, y luego convertimos cada curso a un
  // rango de fechas (inferido del nombre, o de las fechas de sus entries).
  // El curso en el que aparecía cada asignatura se conserva como
  // `originCursoId` — solo se usa como pista para el registro diario
  // cuando la asignatura todavía no tiene ningún minuto registrado (ver
  // subjectsForRegisterInCurso), no vuelve a haber vínculo manual.
  const subjectsById = {};
  const originBySubjectId = {};
  const entries = {};
  const rawCursos = raw.cursos || [];
  const cursoSubjectIds = [];
  rawCursos.forEach((c) => {
    const subjectIds = [];
    (c.subjects || []).forEach((s) => {
      subjectIds.push(s.id);
      if (!subjectsById[s.id]) {
        subjectsById[s.id] = {
          id: s.id,
          name: s.name,
          credits: s.credits,
          target: s.target ?? null,
          color: s.color,
          estado: s.estado || "en_curso",
          mergedInto: s.mergedInto ?? null,
          frozen: s.frozen || null,
        };
        originBySubjectId[s.id] = c.id;
      }
    });
    (c.subjectIds || []).forEach((id) => {
      subjectIds.push(id);
      if (!(id in originBySubjectId)) originBySubjectId[id] = c.id;
    });
    Object.entries(c.entries || {}).forEach(([date, bySubject]) => {
      entries[date] = { ...(entries[date] || {}), ...bySubject };
    });
    cursoSubjectIds.push({ curso: c, subjectIds });
  });

  const cursos = cursoSubjectIds.map(({ curso: c, subjectIds }) => ({
    id: c.id,
    name: c.name,
    ...(inferCursoRange(c.name) || fallbackCursoRange({ ...c, subjectIds }, { entries })),
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    activeCursoId: raw.activeCursoId,
    cursos,
    subjects: Object.values(subjectsById).map((s) => ({ ...s, originCursoId: originBySubjectId[s.id] ?? null })),
    entries,
  };
}

/** Si un curso migrado no tiene nombre "AAAA-AAAA", deduce un rango a
 * partir de las fechas mínima/máxima de las entries de sus asignaturas
 * (v2), expandido a año natural completo para no cortar el historial. */
function fallbackCursoRange(curso, { entries }) {
  const ids = new Set(curso.subjectIds || []);
  let min = null, max = null;
  Object.entries(entries).forEach(([date, bySubject]) => {
    if (Object.keys(bySubject).some((id) => ids.has(id) && bySubject[id] > 0)) {
      if (!min || date < min) min = date;
      if (!max || date > max) max = date;
    }
  });
  if (!min) return { startDate: null, endDate: null };
  return { startDate: `${min.slice(0, 4)}-01-01`, endDate: `${max.slice(0, 4)}-12-31` };
}

/* ------------------------------------------------------------------ */
/*  FILTRO AUTOMÁTICO POR CURSO ACADÉMICO (rango de fechas)            */
/* ------------------------------------------------------------------ */

/** Subconjunto de `entries` cuya fecha cae dentro de [start, end] (ambos
 * inclusive; cualquiera de los dos puede ser null para no acotar por ese
 * lado). */
export function entriesInRange(entries, start, end) {
  const out = {};
  Object.entries(entries).forEach(([date, bySubject]) => {
    if ((!start || date >= start) && (!end || date <= end)) out[date] = bySubject;
  });
  return out;
}

/** Asignaturas que tienen al menos un registro con minutos > 0 dentro del
 * rango de fechas dado — así se decide qué asignaturas "pertenecen" a un
 * curso académico, sin que el usuario tenga que vincular nada a mano. */
export function subjectsWithActivityInRange(subjects, entries, start, end) {
  const ranged = entriesInRange(entries, start, end);
  const activeIds = new Set();
  Object.values(ranged).forEach((bySubject) => {
    Object.entries(bySubject).forEach(([id, minutes]) => { if (minutes > 0) activeIds.add(id); });
  });
  return subjects.filter((s) => activeIds.has(s.id));
}

/** Si una asignatura tiene algún registro con minutos > 0, en cualquier
 * fecha (útil para no ocultar del registro diario una asignatura recién
 * creada, que todavía no "pertenece" a ningún curso por fecha). */
export function subjectHasAnyEntries(entries, subjectId) {
  return Object.values(entries).some((bySubject) => bySubject[subjectId] > 0);
}

/** Asignaturas a mostrar en el registro diario (Bitácora) para un curso
 * concreto: las que tienen actividad en su rango de fechas (como el resto
 * de vistas), más las recién creadas sin ningún registro todavía cuyo
 * `originCursoId` (el curso que estaba seleccionado al crearlas) coincida
 * con este — así una asignatura vacía no se cuela en todos los cursos. */
export function subjectsForRegisterInCurso(subjects, entries, curso) {
  const active = subjectsWithActivityInRange(subjects, entries, curso.startDate, curso.endDate);
  const activeIds = new Set(active.map((s) => s.id));
  const empty = subjects.filter(
    (s) => !activeIds.has(s.id) && !subjectHasAnyEntries(entries, s.id) && s.originCursoId === curso.id
  );
  return [...active, ...empty];
}

/* ------------------------------------------------------------------ */
/*  CALCULOS DERIVADOS — vista "En curso" / "Panel" / "Trayectoria"    */
/*  (operan sobre un subconjunto de asignaturas + el mapa global de     */
/*   entries, filtrando a solo esos ids)                                */
/* ------------------------------------------------------------------ */

export function computeStats(subjects, entries) {
  const subjectIds = new Set(subjects.map((s) => s.id));
  const dates = Object.keys(entries).sort();
  const dailyTotals = {};
  const dailyBySubject = {};
  let maxSession = { minutes: 0, date: null, subjectId: null };

  dates.forEach((date) => {
    let dayTotal = 0;
    const dayEntries = {};
    Object.entries(entries[date]).forEach(([subId, minutes]) => {
      if (!subjectIds.has(subId) || !minutes) return;
      dayTotal += minutes;
      dayEntries[subId] = minutes;
      if (minutes > maxSession.minutes) {
        maxSession = { minutes, date, subjectId: subId };
      }
    });
    if (dayTotal > 0) {
      dailyTotals[date] = dayTotal;
      dailyBySubject[date] = dayEntries;
    }
  });

  const activeDates = Object.keys(dailyTotals).sort();
  const globalTotal = activeDates.reduce((acc, d) => acc + dailyTotals[d], 0);

  let longest = 0, run = 0, prev = null;
  activeDates.forEach((d) => {
    if (prev && daysBetween(prev, d) === 1) run += 1;
    else run = 1;
    if (run > longest) longest = run;
    prev = d;
  });

  const today = isoToday();
  const activeSet = new Set(activeDates);
  let cursor = today;
  if (!activeSet.has(cursor)) cursor = addDays(cursor, -1);
  let current = 0;
  while (activeSet.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const lastActiveDate = activeDates[activeDates.length - 1] || null;
  const daysSinceLast = lastActiveDate ? daysBetween(lastActiveDate, today) : null;

  const perSubject = subjects.map((sub) => {
    let total = 0, daysActive = 0, last = null, maxDay = 0, maxDayDate = null;
    activeDates.forEach((d) => {
      const m = dailyBySubject[d][sub.id];
      if (m) {
        total += m;
        daysActive += 1;
        if (!last || d > last) last = d;
        if (m > maxDay) { maxDay = m; maxDayDate = d; }
      }
    });
    const hoursPerCredit = sub.credits > 0 ? total / 60 / sub.credits : 0;
    const pct = globalTotal > 0 ? (total / globalTotal) * 100 : 0;
    const avgActiveDay = daysActive > 0 ? total / daysActive : 0;
    const daysSince = last ? daysBetween(last, today) : null;
    return {
      ...sub,
      total, daysActive, pct, hoursPerCredit, avgActiveDay,
      last, daysSince, maxDay, maxDayDate,
    };
  });

  return {
    dailyTotals, dailyBySubject, activeDates, globalTotal, longest, current,
    lastActiveDate, daysSinceLast, maxSession, perSubject,
    totalDaysLogged: activeDates.length,
  };
}

/** Historial completo (fecha + minutos) de una asignatura, ordenado. */
export function getSubjectEntries(entries, subjectId, order = "desc") {
  const list = Object.entries(entries)
    .map(([date, bySubject]) => ({ date, minutes: bySubject[subjectId] || 0 }))
    .filter((e) => e.minutes > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return order === "desc" ? list.reverse() : list;
}

/** Listado plano de TODOS los registros diarios de TODAS las asignaturas
 * (en_curso, suspendida y aprobada), mezclados y ordenados por fecha
 * (desc por defecto) — para la vista de historial general. */
export function getAllEntriesFlat(subjects, entries, order = "desc") {
  const out = [];
  Object.entries(entries).forEach(([date, bySubject]) => {
    Object.entries(bySubject).forEach(([subjectId, minutes]) => {
      if (!minutes) return;
      const subject = subjects.find((s) => s.id === subjectId);
      if (!subject) return;
      out.push({ date, minutes, subjectId, subjectName: subject.name, subjectColor: subject.color });
    });
  });
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.subjectName.localeCompare(b.subjectName)));
  return order === "desc" ? out.reverse() : out;
}

/** Ids de las asignaturas cuyos minutos cuentan, combinados, para `subjectId`
 * en la clasificación histórica: ella misma más cualquier otra con
 * mergedInto === subjectId (p. ej. una convalidada por Erasmus). */
export function getMergedSourceIds(subjects, subjectId) {
  return subjects.filter((s) => s.mergedInto === subjectId).map((s) => s.id);
}

/** Ids de las asignaturas fusionadas en `subjectId` que además ya están
 * ellas mismas "aprobada" — solo estas cuentan de verdad en el histórico
 * combinado (ver computeClassification): mientras la fuente (p. ej. una
 * asignatura de Erasmus) no esté aprobada, sus horas todavía no se suman
 * a la oficial, aunque el vínculo "Combinar con" ya esté puesto. */
export function getApprovedMergedSourceIds(subjects, subjectId) {
  return subjects.filter((s) => s.mergedInto === subjectId && s.estado === "aprobada").map((s) => s.id);
}

function combineEntriesOf(entries, ids) {
  const byDate = {};
  ids.forEach((id) => {
    getSubjectEntries(entries, id, "asc").forEach((e) => {
      byDate[e.date] = (byDate[e.date] || 0) + e.minutes;
    });
  });
  return Object.entries(byDate)
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Historial combinado (fecha + minutos sumados) de una asignatura y TODAS
 * las que tiene fusionadas (mergedInto), estén o no aprobada ellas mismas.
 * Uso general / informativo — para el cómputo real de horas/crédito de la
 * clasificación histórica usa getApprovedCombinedEntries. */
export function getCombinedEntries(entries, subjects, subjectId) {
  return combineEntriesOf(entries, [subjectId, ...getMergedSourceIds(subjects, subjectId)]);
}

/** Historial combinado (fecha + minutos) de una asignatura y solo las
 * fusionadas que YA están aprobada — el que de verdad cuenta para la
 * clasificación histórica en cada momento (ver computeClassification). */
export function getApprovedCombinedEntries(entries, subjects, subjectId) {
  return combineEntriesOf(entries, [subjectId, ...getApprovedMergedSourceIds(subjects, subjectId)]);
}

/* ------------------------------------------------------------------ */
/*  VISTA "DESGASTE" — bloques de estudio, bloque peor, índice          */
/* ------------------------------------------------------------------ */

const BLOQUE_UMBRAL_DESCANSO = 3; // días de descanso que aún no rompen el bloque
const BLOQUE_MIN_DIAS_ACTIVOS = 3; // mínimo para ser candidato a "peor bloque"

export const WEAR_WEIGHTS = { intensidad: 0.30, duracion: 0.30, compresion: 0.20, racha: 0.20 };
export const WEAR_FORMULA_VERSION = "v1";

/** Agrupa el historial (ascendente) de una asignatura en bloques de estudio
 * consecutivos o casi consecutivos (corte: más de 3 días de descanso). */
export function detectBlocks(subjectEntriesAsc) {
  const groups = [];
  let current = null;
  subjectEntriesAsc.forEach((e) => {
    if (!current) {
      current = [e];
    } else {
      const prevDate = current[current.length - 1].date;
      const restDays = daysBetween(prevDate, e.date) - 1;
      if (restDays > BLOQUE_UMBRAL_DESCANSO) {
        groups.push(current);
        current = [e];
      } else {
        current.push(e);
      }
    }
  });
  if (current) groups.push(current);

  return groups.map((block) => {
    const dias_activos = block.length;
    const first = block[0].date;
    const last = block[block.length - 1].date;
    const span = daysBetween(first, last) + 1;
    const minutos_totales = block.reduce((a, e) => a + e.minutes, 0);
    const intensidad = minutos_totales / dias_activos;
    const compresion = dias_activos / span;
    let racha_interna = 1, run = 1;
    for (let i = 1; i < block.length; i++) {
      run = daysBetween(block[i - 1].date, block[i].date) === 1 ? run + 1 : 1;
      if (run > racha_interna) racha_interna = run;
    }
    return { dias_activos, span, minutos_totales, intensidad, compresion, racha_interna, first, last };
  });
}

/** El "bloque peor": mayor intensidad entre los bloques con >= 3 días activos. */
export function selectWorstBlock(blocks) {
  const candidates = blocks.filter((b) => b.dias_activos >= BLOQUE_MIN_DIAS_ACTIVOS);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, b) => (b.intensidad > best.intensidad ? b : best), candidates[0]);
}

function rawFactorsOf(block) {
  return {
    intensidad: block.intensidad,
    duracion: block.dias_activos,
    compresion: block.compresion,
    racha: block.racha_interna,
  };
}

function computeTopes(rawFactorList) {
  const topes = { intensidad: 0, duracion: 0, compresion: 0, racha: 0 };
  rawFactorList.forEach((f) => {
    topes.intensidad = Math.max(topes.intensidad, f.intensidad);
    topes.duracion = Math.max(topes.duracion, f.duracion);
    topes.compresion = Math.max(topes.compresion, f.compresion);
    topes.racha = Math.max(topes.racha, f.racha);
  });
  return topes;
}

function normalizeFactor(raw, tope) {
  if (!tope) return 0;
  return Math.min(raw / tope, 1) * 10;
}

export function wearLabel(score) {
  if (score < 2.5) return "Llevadero";
  if (score < 5) return "Moderado";
  if (score < 7.5) return "Duro";
  return "Extremo";
}

/** Mínimo de asignaturas aprobadas y comparables para que el índice de
 * desgaste se considere una referencia estable (si no, se marca como dato
 * provisional en la interfaz — puede cambiar mucho con cada aprobación). */
export const WEAR_STABLE_MIN_SAMPLE = 5;

/**
 * Calcula el desgaste de una asignatura a partir de su bloque peor. Se
 * recalcula siempre al vuelo (nunca se guarda como valor fijo): el tope de
 * cada factor es el máximo histórico ACTUAL entre todas las asignaturas
 * aprobada y comparables, así que puede cambiar de una aprobación a otra.
 * - `priorRawFactorsList`: factores brutos del bloque peor de otras
 *   asignaturas ya "aprobada" y comparables (para fijar los topes).
 * - `includeSelf`: si esta asignatura es "aprobada", ella misma entra a
 *   formar parte del conjunto que define los topes; si es una vista previa
 *   (aún no aprobada), no.
 * Devuelve { comparable: false } si no hay ningún bloque con >= 3 días activos.
 * Devuelve { comparable: true, hasTopes: false, ... } si es comparable pero
 * todavía no existe ninguna asignatura aprobada con la que fijar un tope.
 */
export function computeDesgaste(subjectId, entries, priorRawFactorsList, { includeSelf = false } = {}) {
  const subjectEntriesAsc = getSubjectEntries(entries, subjectId, "asc");
  const blocks = detectBlocks(subjectEntriesAsc);
  const worst = selectWorstBlock(blocks);
  if (!worst) return { comparable: false };

  const rawFactors = rawFactorsOf(worst);
  const list = includeSelf ? [...priorRawFactorsList, rawFactors] : priorRawFactorsList;
  if (list.length === 0) {
    return { comparable: true, hasTopes: false, rawFactors, worstBlock: worst, sampleSize: list.length };
  }

  const topes = computeTopes(list);
  const normalized = {
    intensidad: normalizeFactor(rawFactors.intensidad, topes.intensidad),
    duracion: normalizeFactor(rawFactors.duracion, topes.duracion),
    compresion: normalizeFactor(rawFactors.compresion, topes.compresion),
    racha: normalizeFactor(rawFactors.racha, topes.racha),
  };
  const indice = +(
    WEAR_WEIGHTS.intensidad * normalized.intensidad +
    WEAR_WEIGHTS.duracion * normalized.duracion +
    WEAR_WEIGHTS.compresion * normalized.compresion +
    WEAR_WEIGHTS.racha * normalized.racha
  ).toFixed(2);

  return {
    comparable: true,
    hasTopes: true,
    rawFactors,
    normalized,
    topes,
    indice,
    etiqueta: wearLabel(indice),
    worstBlock: worst,
    sampleSize: list.length,
    provisional: list.length < WEAR_STABLE_MIN_SAMPLE,
    formulaVersion: WEAR_FORMULA_VERSION,
    weights: WEAR_WEIGHTS,
  };
}

/** Factores brutos del bloque peor de una asignatura (o null si no es
 * comparable), calculados siempre en el momento a partir de sus entries. */
function ownRawFactors(subjectId, entries) {
  const asc = getSubjectEntries(entries, subjectId, "asc");
  const worst = selectWorstBlock(detectBlocks(asc));
  return worst ? rawFactorsOf(worst) : null;
}

/** Lista, calculada al vuelo, de los factores brutos de todas las
 * asignaturas ya aprobada y comparables (excluyendo, si se pasa, la propia
 * asignatura). Define los topes de normalización vigentes ahora mismo. */
export function priorComparableRawFactors(subjects, entries, excludeSubjectId = null) {
  return subjects
    .filter((s) => s.id !== excludeSubjectId && s.estado === "aprobada")
    .map((s) => ownRawFactors(s.id, entries))
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  CONGELAR ASIGNATURA (marcar "aprobada")                            */
/* ------------------------------------------------------------------ */

/** Marca una asignatura como aprobada: congela nota, cursos necesarios y
 * fecha de aprobación — datos administrativos que no cambian. Horas/
 * crédito, días totales y fecha de inicio NO se congelan aquí: se
 * recalculan siempre al vuelo (ver computeClassification), igual que ya
 * pasa con el desgaste, porque dependen del historial combinado con
 * cualquier asignatura fusionada (mergedInto) — y esa combinación solo
 * cuenta de verdad a partir del momento en que la fuente combinada
 * también esté aprobada. Si "Calcolo Numerico" está combinada con
 * "Métodos Matemáticos" pero Calcolo todavía no está aprobada, las horas
 * de Métodos no la incluyen todavía; en cuanto se aprueba Calcolo, la
 * clasificación de Métodos se actualiza sola, sin volver a tocar nada. */
export function freezeApproval(subject, { nota, cursosNecesarios, fechaAprobacion = isoToday() }) {
  return {
    ...subject,
    estado: "aprobada",
    frozen: {
      nota: nota !== "" && nota != null ? parseFloat(nota) : null,
      cursosNecesarios: cursosNecesarios !== "" && cursosNecesarios != null ? parseInt(cursosNecesarios, 10) : null,
      fechaAprobacion,
    },
  };
}

/** Cifras de clasificación histórica de una asignatura YA aprobada,
 * calculadas siempre al vuelo a partir del historial combinado actual
 * (ella misma + las fusionadas que a su vez ya estén aprobada). */
export function computeClassification(subject, entries, subjects) {
  const combinedAsc = getApprovedCombinedEntries(entries, subjects, subject.id);
  const firstDate = combinedAsc[0]?.date ?? null;
  const minutosTotales = combinedAsc.reduce((a, e) => a + e.minutes, 0);
  const horasPorCredito = subject.credits > 0 ? minutosTotales / 60 / subject.credits : 0;
  const fechaAprobacion = subject.frozen?.fechaAprobacion ?? isoToday();
  const diasTotales = firstDate ? daysBetween(firstDate, fechaAprobacion) + 1 : 0;
  return { fechaInicio: firstDate, horasPorCredito: +horasPorCredito.toFixed(3), diasTotales, minutosTotales };
}

/* ------------------------------------------------------------------ */
/*  IMPORTACIÓN HISTÓRICA (cursos 2022-2025) — aplicación en la app     */
/* ------------------------------------------------------------------ */

export const HISTORICAL_IMPORT_VERSION = 1;

/**
 * Aplica, una sola vez (marca `data.historicalImportV1 = true`), la
 * importación de los cursos 2022-2023, 2023-2024 y 2024-2025:
 * - añade las 18 asignaturas reconstruidas desde los Excel de horas de
 *   estudio + el expediente académico oficial (créditos y notas reales),
 *   con sus registros diarios,
 * - las ya aprobadas se congelan con freezeApproval (misma lógica que si
 *   el usuario las marcase aprobada a mano),
 * - "Calcolo Numerico" (Erasmus, ya existente) pasa a combinarse
 *   ("Combinar con") dentro de la nueva "Métodos Matemáticos" (la
 *   asignatura oficial del expediente), y sus créditos se corrigen de 6
 *   (valor provisional) a los 4,5 reales,
 * - añade los cursos académicos 2022-2023, 2023-2024 y 2024-2025.
 * Idempotente: si ya se aplicó, devuelve `data` sin tocar.
 */
export function applyHistoricalImport(data) {
  if (!data || data.historicalImportV1) return data;

  const nameToId = {};
  const importSubjects = HISTORICAL_IMPORT_SUBJECT_DEFS.map((def, i) => {
    const id = uid("sub");
    nameToId[def.name] = id;
    return {
      id, name: def.name, credits: def.credits, target: null,
      color: PALETTE[(data.subjects.length + i) % PALETTE.length],
      estado: def.estado, mergedInto: null, originCursoId: null, frozen: null,
    };
  });

  const calcoloNumerico = data.subjects.find((s) => s.name === "Calcolo Numerico");
  const metodosId = nameToId["Métodos Matemáticos"];

  let subjects = [
    ...data.subjects.map((s) =>
      calcoloNumerico && s.id === calcoloNumerico.id ? { ...s, credits: 4.5, mergedInto: metodosId } : s
    ),
    ...importSubjects,
  ];

  let entries = { ...data.entries };
  Object.entries(HISTORICAL_IMPORT_ENTRIES).forEach(([date, byName]) => {
    const bySubjectId = {};
    Object.entries(byName).forEach(([name, minutes]) => { bySubjectId[nameToId[name]] = minutes; });
    entries[date] = { ...(entries[date] || {}), ...bySubjectId };
  });

  HISTORICAL_IMPORT_SUBJECT_DEFS.forEach((def) => {
    if (def.estado !== "aprobada") return;
    const id = nameToId[def.name];
    const subject = subjects.find((s) => s.id === id);
    const own = getSubjectEntries(entries, id, "desc");
    const fechaAprobacion = own.length ? own[0].date : isoToday();
    const approved = freezeApproval(subject, { nota: def.nota, cursosNecesarios: def.cursosNecesarios, fechaAprobacion });
    subjects = subjects.map((s) => (s.id === id ? approved : s));
  });

  const newCursos = [
    { id: uid("curso"), name: "2022-2023", ...inferCursoRange("2022-2023") },
    { id: uid("curso"), name: "2023-2024", ...inferCursoRange("2023-2024") },
    { id: uid("curso"), name: "2024-2025", ...inferCursoRange("2024-2025") },
  ];

  return {
    ...data,
    cursos: [...data.cursos, ...newCursos],
    subjects,
    entries,
    historicalImportV1: true,
  };
}
