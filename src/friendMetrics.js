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
  const weekStart = addDays(today, -6);
  let weekMinutes = 0;
  const todayMinutes = Object.values(entries[today] ?? {}).reduce((a, m) => a + (m || 0), 0);
  Object.entries(entries).forEach(([date, bySubject]) => {
    if (date >= weekStart && date <= today) weekMinutes += Object.values(bySubject).reduce((a, m) => a + (m || 0), 0);
  });
  return {
    season, live, rango,
    tier: rango.tier,
    puntos: rango.puntos,
    streak: stats.current,
    bestStreak: stats.longest,
    weekMinutes,
    todayMinutes,
    history: getSeasonHistory(subjects, entries, logs),
    dailyTotals: stats.dailyTotals,
  };
}

/** ¿Cuenta esta asignatura en lo social (clasificación, fichas de amigos, comunidad)? Solo si su
 * canónica está aprobada por el admin o es de Erasmus. Igual que hace el servidor en
 * resumen_amigo / clasificacion_global: las creadas a mano no suman a nadie más que a su dueño. */
export function countsForSocial(subject) {
  return subject.esErasmus === true || subject.canonicalEstado === "aprobada";
}

/** summarizeStudy de lo que ven los demás de mí: sin las asignaturas que no cuentan en lo social
 * (ni sus minutos ni sus registros, para que tampoco alimenten rachas ni cifras de hoy/semana). */
export function summarizeSocial(subjects, entries, logs) {
  const ids = new Set(subjects.filter(countsForSocial).map((s) => s.id));
  const socialEntries = {};
  Object.entries(entries).forEach(([date, bySubject]) => {
    const kept = Object.fromEntries(Object.entries(bySubject).filter(([id]) => ids.has(id)));
    if (Object.keys(kept).length) socialEntries[date] = kept;
  });
  return summarizeStudy(subjects.filter((s) => ids.has(s.id)), socialEntries, (logs || []).filter((l) => ids.has(l.subjectId)));
}

/** Modelo de un amigo a partir de lo que devuelve resumen_amigo. */
export function buildFriendModel(resumen) {
  const subjects = (resumen.asignaturas ?? []).map((a) => ({
    id: String(a.ref), name: a.nombre, credits: Number(a.creditos) || 0, estado: a.estado, color: a.color,
    sinCreditos: a.sin_creditos === true, esErasmus: a.es_erasmus === true,
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
    numSubjects: Number(resumen.n_asignaturas) || 0,
    hpcTotal: resumen.horas_por_credito == null ? null : Number(resumen.horas_por_credito),
    subjects,
    logs,
    ...summarizeStudy(subjects, entries, logs),
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
  const counted = new Set(subjects.filter((s) => !s.sinCreditos).map((s) => s.id));
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
