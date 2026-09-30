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
  Object.entries(entries).forEach(([date, bySubject]) => {
    if (date >= weekStart && date <= today) weekMinutes += Object.values(bySubject).reduce((a, m) => a + (m || 0), 0);
  });
  return {
    season, live, rango,
    tier: rango.tier,
    hpcSeason: rango.hoursPerCredit,
    streak: stats.current,
    bestStreak: stats.longest,
    weekMinutes,
    history: getSeasonHistory(subjects, entries, logs),
    dailyTotals: stats.dailyTotals,
  };
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
    showGrades: resumen.mostrar_notas === true,
    totalMinutes: Number(resumen.minutos_totales) || 0,
    numSubjects: Number(resumen.n_asignaturas) || 0,
    hpcTotal: resumen.horas_por_credito == null ? null : Number(resumen.horas_por_credito),
    subjects,
    ...summarizeStudy(subjects, entries, logs),
  };
}

/** Orden de la clasificación: mayor rango primero y, a igualdad, más h/crédito. */
export function compareByRank(a, b) {
  if (b.tier !== a.tier) return b.tier - a.tier;
  return b.hpcSeason - a.hpcSeason;
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
