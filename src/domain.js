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
    if (raw.subjects.every((s) => "mergedInto" in s) && raw.cursos.every((c) => "startDate" in c)) return raw;
    return {
      ...raw,
      subjects: raw.subjects.map((s) => ({ mergedInto: null, ...s })),
      cursos: raw.cursos.map((c) => ("startDate" in c ? c : { id: c.id, name: c.name, ...(inferCursoRange(c.name) || fallbackCursoRange(c, raw)) })),
    };
  }

  // v2 (subjectIds por curso) o esquema original (subjects/entries anidados
  // en cada curso): en ambos casos, primero recolectamos subjects/entries
  // a nivel global igual que antes, y luego convertimos cada curso a un
  // rango de fechas (inferido del nombre, o de las fechas de sus entries).
  const subjectsById = {};
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
      }
    });
    (c.subjectIds || []).forEach((id) => subjectIds.push(id));
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
    subjects: Object.values(subjectsById),
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

/** Historial combinado (fecha + minutos sumados) de una asignatura y todas
 * las que tiene fusionadas (mergedInto) para el cómputo histórico. */
export function getCombinedEntries(entries, subjects, subjectId) {
  const ids = [subjectId, ...getMergedSourceIds(subjects, subjectId)];
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

/** Marca una asignatura como aprobada: congela nota, cursos necesarios,
 * horas/crédito y días totales. El índice de desgaste NO se congela aquí —
 * se recalcula siempre al vuelo (ver computeDesgaste) para que los topes de
 * normalización reflejen el historial completo y actualizado, no solo el
 * que existía en el momento de aprobar esta asignatura en concreto.
 *
 * Horas/crédito y días totales se calculan sobre el historial combinado
 * (esta asignatura + cualquier otra fusionada con mergedInto), porque son
 * las cifras de "cuánto costó de verdad". */
export function freezeApproval(subject, { entries, subjects, nota, cursosNecesarios, fechaAprobacion = isoToday() }) {
  const combinedAsc = getCombinedEntries(entries, subjects, subject.id);
  const firstDate = combinedAsc[0]?.date ?? null;
  const minutosTotales = combinedAsc.reduce((a, e) => a + e.minutes, 0);
  const horasPorCredito = subject.credits > 0 ? minutosTotales / 60 / subject.credits : 0;
  const diasTotales = firstDate ? daysBetween(firstDate, fechaAprobacion) + 1 : 0;

  return {
    ...subject,
    estado: "aprobada",
    frozen: {
      nota: nota !== "" && nota != null ? parseFloat(nota) : null,
      cursosNecesarios: cursosNecesarios !== "" && cursosNecesarios != null ? parseInt(cursosNecesarios, 10) : null,
      fechaInicio: firstDate,
      fechaAprobacion,
      horasPorCredito: +horasPorCredito.toFixed(3),
      diasTotales,
      minutosTotales,
    },
  };
}
