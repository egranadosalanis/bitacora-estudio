import {
  getCurrentSeason, computeSeasonRango, getSeasonHistory, computeStats, buildEntriesFromLogs,
  isoToday, addDays, RANK_THRESHOLDS,
} from "./domain.js";

/* Rango, racha y demás cifras de una persona a partir de su lista de
   asignaturas, sus minutos por día y sus registros. Sirve igual para el propio
   usuario (con sus datos) que para un amigo (con lo que devuelve resumen_amigo),
   así los dos usan exactamente las mismas fórmulas de domain.js. */
export function summarizeStudy(subjects, entries, logs) {
  const { season, live } = getCurrentSeason();
  const rango = computeSeasonRango(subjects, entries, logs, season);
  const stats = computeStats(subjects, entries, logs);
  const today = isoToday();
  const weekStart = weekStartOf(today);
  let weekMinutes = 0;
  // Igual que la clasificación semanal y los puntos de rango: las asignaturas «sin créditos» no suman horas.
  const counted = new Set(subjects.filter((s) => !s.sinCreditos).map((s) => s.id));
  const sumDay = (bySubject) => Object.entries(bySubject ?? {}).reduce((a, [id, m]) => a + (counted.has(id) ? m || 0 : 0), 0);
  const todayMinutes = sumDay(entries[today]);
  Object.entries(entries).forEach(([date, bySubject]) => {
    if (date >= weekStart && date <= today) weekMinutes += sumDay(bySubject);
  });
  return {
    season, live, rango,
    tier: rango.tier,
    puntos: rango.puntos,
    streak: stats.current,
    bestStreak: stats.longest,
    weekMinutes,
    weekStart,
    todayMinutes,
    history: getSeasonHistory(subjects, entries, logs),
    dailyTotals: stats.dailyTotals,
  };
}

/** ¿Cuenta esta asignatura en lo social (clasificación, rango, racha)? Solo si su canónica está
 * aprobada por el admin o es de Erasmus. Las creadas a mano se ven, pero no puntúan. Para los
 * amigos el servidor ya manda `cuenta`; para las asignaturas propias se deduce del estado de la canónica. */
export function countsForSocial(subject) {
  if (typeof subject.cuenta === "boolean") return subject.cuenta;
  return subject.esErasmus === true || subject.canonicalEstado === "aprobada";
}

/** summarizeStudy sin las asignaturas que no cuentan en lo social (ni sus minutos ni sus registros,
 * para que tampoco alimenten rachas ni cifras de hoy/semana). */
export function summarizeSocial(subjects, entries, logs) {
  const ids = new Set(subjects.filter(countsForSocial).map((s) => s.id));
  const socialEntries = {};
  Object.entries(entries).forEach(([date, bySubject]) => {
    const kept = Object.fromEntries(Object.entries(bySubject).filter(([id]) => ids.has(id)));
    if (Object.keys(kept).length) socialEntries[date] = kept;
  });
  return summarizeStudy(subjects.filter((s) => ids.has(s.id)), socialEntries, (logs || []).filter((l) => ids.has(l.subjectId)));
}

/** Una fila por asignatura para el desglose: los intentos de una misma asignatura en varios cursos
 * (misma asignatura repetida o dividida por curso) llegan del servidor como filas distintas con el
 * mismo nombre; aquí se juntan en una sola (suman minutos; vale el dato de la aprobada, si la hay). */
const normName = (n) => String(n ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function groupSubjectsForDisplay(subjects) {
  const groups = new Map();
  subjects.forEach((s) => {
    const key = `${s.esErasmus ? "e" : "u"}|${normName(s.name)}`;
    const g = groups.get(key);
    if (!g) { groups.set(key, { ...s, minutos: s.minutos || 0 }); return; }
    const best = s.estado === "aprobada" && g.estado !== "aprobada" ? s : g;
    groups.set(key, {
      ...best, id: g.id, minutos: g.minutos + (s.minutos || 0),
      cuenta: g.cuenta !== false || s.cuenta !== false,
      credits: Math.max(g.credits, s.credits),
      hpc: best.hpc ?? g.hpc ?? s.hpc, nota: best.nota ?? g.nota ?? s.nota,
    });
  });
  return [...groups.values()];
}

/** Modelo de un amigo a partir de lo que devuelve resumen_amigo. */
export function buildFriendModel(resumen) {
  const subjects = (resumen.asignaturas ?? []).map((a) => ({
    id: String(a.ref), name: a.nombre, credits: Number(a.creditos) || 0, estado: a.estado, color: a.color,
    sinCreditos: a.sin_creditos === true, cuenta: a.cuenta !== false, esErasmus: a.es_erasmus === true,
    hpc: a.horas_por_credito, nota: a.nota, cursosNecesarios: a.cursos_necesarios, minutos: a.minutos,
  }));
  const logs = (resumen.historial ?? []).map((h) => ({
    id: `${h.fecha}-${h.ref}`, date: h.fecha, subjectId: String(h.ref), minutes: h.minutos,
  }));
  const entries = buildEntriesFromLogs(logs);
  return {
    username: resumen.username,
    verified: resumen.verificado === true,
    avatarUrl: resumen.avatar_url ?? null,
    avatarPath: resumen.avatar_path ?? null,
    showGrades: resumen.mostrar_notas === true,
    totalMinutes: Number(resumen.minutos_totales) || 0,
    numSubjects: groupSubjectsForDisplay(subjects).length,
    hpcTotal: resumen.horas_por_credito == null ? null : Number(resumen.horas_por_credito),
    subjects,
    displaySubjects: groupSubjectsForDisplay(subjects),
    logs,
    ...summarizeSocial(subjects, entries, logs),
  };
}

/** Orden de la clasificación: mayor rango primero y, a igualdad, más puntos. */
export function compareByRank(a, b) {
  if (b.tier !== a.tier) return b.tier - a.tier;
  return b.puntos - a.puntos;
}

/** Lunes (fecha ISO) de la semana a la que pertenece `iso`. Las semanas van de lunes a domingo. */
export function weekStartOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lunes
  return addDays(iso, -dow);
}

/** Minutos estudiados y días con estudio de cada semana (clave = lunes), a partir del mapa de
 * entradas `{ fecha: { asignaturaId: minutos } }`. Igual que los puntos de rango, no cuentan las
 * asignaturas «sin créditos». Todo se calcula al vuelo: no se guarda nada por semana. */
export function weeklyMinutes(subjects, entries) {
  // Mismo criterio que el resto de Social: con créditos y que puntúen (canónica aprobada o Erasmus).
  const counted = new Set(subjects.filter((s) => !s.sinCreditos && countsForSocial(s)).map((s) => s.id));
  const out = new Map();
  Object.entries(entries).forEach(([date, bySubject]) => {
    let day = 0;
    Object.entries(bySubject).forEach(([id, m]) => { if (m > 0 && counted.has(id)) day += m; });
    if (day <= 0) return;
    const wk = weekStartOf(date);
    const cur = out.get(wk) || { minutes: 0, days: 0 };
    cur.minutes += day;
    cur.days += 1;
    out.set(wk, cur);
  });
  return out;
}

/** Celdas del mapa de calor: `weeks` semanas completas terminando esta semana
 * (lunes a domingo), con los minutos de cada día. Las fechas futuras salen a null. */
export function heatmapCells(dailyTotals, weeks = 12) {
  const today = isoToday();
  const [y, m, d] = today.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lunes
  const start = addDays(today, -(dow + (weeks - 1) * 7));
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, w * 7 + i);
      col.push({ date, minutes: date > today ? null : dailyTotals[date] || 0 });
    }
    cols.push(col);
  }
  return cols;
}

export { RANK_THRESHOLDS };
