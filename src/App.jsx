import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  PALETTE, uid, isoToday, addDays, formatShort, formatLong, formatMedium, hm,
  computeStats, getSubjectEntries, getAllEntriesFlat,
  computeDesgaste, freezeApproval, computeClassification,
  inferCursoRange, entriesInRange, subjectsWithActivityInRange, subjectsForRegisterInCurso,
} from "./domain.js";
import {
  loadUserData, saveDayEntries, deleteDayEntries, insertSubject, deleteSubject, updateSubject,
  updateSubjectEstado, approveSubject, insertCurso, updateCursoEstado, deleteCurso,
} from "./supabaseData.js";

/* ------------------------------------------------------------------ */
/*  COMPONENTES DE UI GENERICOS                                        */
/* ------------------------------------------------------------------ */

function Gauge({ label, value, max, unit, target, color, sub }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const targetPct = target != null && max > 0 ? Math.min(100, (target / max) * 100) : null;
  return (
    <div className="gauge-row">
      <div className="gauge-head">
        <span className="gauge-label">{label}</span>
        <span className="gauge-value">
          {value.toFixed(2)}<span className="gauge-unit">{unit}</span>
        </span>
      </div>
      <div className="gauge-track">
        <div className="gauge-ticks">
          {Array.from({ length: 11 }).map((_, i) => (
            <span key={i} className="gauge-tick" style={{ left: `${i * 10}%` }} />
          ))}
        </div>
        <div className="gauge-fill" style={{ width: `${pct}%`, background: color }} />
        {targetPct != null && (
          <div className="gauge-target" style={{ left: `${targetPct}%` }} title={`Referencia: ${target.toFixed(2)}`} />
        )}
      </div>
      {sub && <div className="gauge-sub">{sub}</div>}
    </div>
  );
}

function StatCard({ label, value, hint, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

function Tab({ id, active, onClick, children }) {
  return (
    <button className={`tab-btn ${active ? "tab-btn-active" : ""}`} onClick={() => onClick(id)}>
      {children}
    </button>
  );
}

const ESTADO_LABELS = { en_curso: "En curso", suspendida: "Suspendida", aprobada: "Aprobada" };

function EstadoBadge({ estado }) {
  return <span className={`badge-estado badge-estado-${estado}`}>{ESTADO_LABELS[estado] || estado}</span>;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box ${wide ? "modal-box-wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: BITACORA (registro diario + historial completo)               */
/* ------------------------------------------------------------------ */

const HISTORY_ALL = ""; // sentinel: "Histórico (todas las asignaturas)"

function clampDate(d, min, max) {
  if (d < min) return min;
  if (d > max) return max;
  return d;
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function BitacoraTab({ cursoSubjects, loggableSubjects, entries, onSaveDay, onDeleteDay, curso }) {
  const todayIso = isoToday();
  const cappedToday = todayIso < curso.endDate ? todayIso : curso.endDate;
  // Si el curso todavía no ha empezado, no hay "hoy" válido dentro de su rango:
  // se permite todo el curso en vez de bloquear cualquier fecha.
  const maxDate = cappedToday >= curso.startDate ? cappedToday : curso.endDate;
  const minDate = curso.startDate;

  const [date, setDate] = useState(() => clampDate(todayIso, minDate, maxDate));
  const [values, setValues] = useState({});
  const [historySubjectId, setHistorySubjectId] = useState(HISTORY_ALL);
  const [visibleCount, setVisibleCount] = useState(20);

  const [mode, setMode] = useState("manual"); // 'manual' | 'contador'
  const [timerSubjectId, setTimerSubjectId] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [timerAccumulatedMs, setTimerAccumulatedMs] = useState(0);
  const [, setTimerTick] = useState(0);

  // Al cambiar de curso, la fecha y la asignatura de historial seleccionadas
  // pueden quedar fuera de rango o dejar de existir en el nuevo curso — se
  // resetean para que los registros siempre se guarden en el curso activo.
  useEffect(() => {
    setDate(clampDate(isoToday(), minDate, maxDate));
    setHistorySubjectId(HISTORY_ALL);
  }, [curso.id]);

  useEffect(() => {
    const existing = entries[date] || {};
    const next = {};
    loggableSubjects.forEach((s) => { next[s.id] = existing[s.id] ? String(existing[s.id]) : ""; });
    setValues(next);
  }, [date, loggableSubjects, entries]);

  useEffect(() => { setVisibleCount(20); }, [historySubjectId]);

  // Si cambias de fecha (o de curso) a media sesión, el contador se para y
  // se resetea — así el tiempo medido nunca se cuela sin querer en el día
  // equivocado.
  useEffect(() => {
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerAccumulatedMs(0);
  }, [date]);

  useEffect(() => {
    if (!timerSubjectId || !loggableSubjects.some((s) => s.id === timerSubjectId)) {
      setTimerSubjectId(loggableSubjects[0]?.id ?? null);
    }
  }, [loggableSubjects, timerSubjectId]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimerTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const timerElapsedMs = timerAccumulatedMs + (timerRunning && timerStartedAt ? Date.now() - timerStartedAt : 0);

  function startTimer() {
    setTimerStartedAt(Date.now());
    setTimerRunning(true);
  }
  function pauseTimer() {
    setTimerAccumulatedMs((ms) => ms + (timerStartedAt ? Date.now() - timerStartedAt : 0));
    setTimerStartedAt(null);
    setTimerRunning(false);
  }
  function finishTimer() {
    const totalMs = timerAccumulatedMs + (timerRunning && timerStartedAt ? Date.now() - timerStartedAt : 0);
    const addedMinutes = Math.round(totalMs / 60000);
    if (addedMinutes > 0 && timerSubjectId) {
      setValues((v) => ({ ...v, [timerSubjectId]: String((parseFloat(v[timerSubjectId]) || 0) + addedMinutes) }));
    }
    setTimerAccumulatedMs(0);
    setTimerStartedAt(null);
    setTimerRunning(false);
  }
  function resetTimer() {
    setTimerAccumulatedMs(0);
    setTimerStartedAt(null);
    setTimerRunning(false);
  }

  const dayTotal = loggableSubjects.reduce((acc, s) => acc + (parseFloat(values[s.id]) || 0), 0);
  const hasEntryToday = !!entries[date] && loggableSubjects.some((s) => entries[date][s.id] > 0);

  const historySubject = historySubjectId !== HISTORY_ALL ? cursoSubjects.find((s) => s.id === historySubjectId) : null;
  const history = historySubjectId === HISTORY_ALL
    ? getAllEntriesFlat(cursoSubjects, entries, "desc")
    : (historySubject ? getSubjectEntries(entries, historySubject.id, "desc") : []);

  return (
    <div className="grid-2">
      <div className="panel">
        <div className="panel-title">Registro de vuelo — {formatLong(date)}</div>
        <div className="field-row">
          <label className="field-label">Fecha</label>
          <input type="date" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} className="input-field" />
        </div>
        {loggableSubjects.length === 0 ? (
          <div className="empty-hint">No hay asignaturas activas (todas están aprobadas o no has añadido ninguna todavía).</div>
        ) : (
          <>
            <div className="seg-control" style={{ marginBottom: 14 }}>
              <button className={`seg-btn ${mode === "manual" ? "seg-btn-active" : ""}`} onClick={() => setMode("manual")}>Manual</button>
              <button className={`seg-btn ${mode === "contador" ? "seg-btn-active" : ""}`} onClick={() => setMode("contador")}>Contador</button>
            </div>

            {mode === "contador" && (
              <div className="timer-box">
                <div className="gauge-sub" style={{ marginBottom: 8 }}>
                  Lo que mida el contador se sumará al registro de {formatMedium(date)} — cambia la fecha arriba si es para otro día.
                </div>
                <div className="field-row">
                  <label className="field-label">Asignatura</label>
                  <select
                    className="input-field"
                    value={timerSubjectId || ""}
                    onChange={(e) => setTimerSubjectId(e.target.value)}
                    disabled={timerRunning}
                  >
                    {loggableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="timer-display mono">{formatElapsed(timerElapsedMs)}</div>
                <div className="btn-row">
                  {!timerRunning ? (
                    <button className="btn-primary" onClick={startTimer} disabled={!timerSubjectId}>
                      {timerElapsedMs > 0 ? "Reanudar" : "Iniciar"}
                    </button>
                  ) : (
                    <button className="btn-ghost" onClick={pauseTimer}>Pausar</button>
                  )}
                  <button className="btn-primary" onClick={finishTimer} disabled={timerElapsedMs < 1000}>
                    Fin — meter en el registro
                  </button>
                  {timerElapsedMs >= 1000 && (
                    <button className="btn-ghost" onClick={resetTimer} title="Vuelve el contador a 00:00 sin meter nada en el registro">
                      Reiniciar
                    </button>
                  )}
                </div>
                {parseFloat(values[timerSubjectId]) > 0 && (
                  <div className="gauge-sub">
                    Ya hay {values[timerSubjectId]} min para esta asignatura ese día — el contador se sumará a eso.
                  </div>
                )}
              </div>
            )}

            {mode === "manual" && (
              <div className="subject-inputs">
                {loggableSubjects.map((s) => (
                  <div className="field-row" key={s.id}>
                    <label className="field-label">
                      <span className="dot" style={{ background: s.color }} />
                      {s.name}
                    </label>
                    <div className="input-with-unit">
                      <input
                        type="number" min="0" step="5" placeholder="0"
                        value={values[s.id] || ""}
                        onChange={(e) => setValues((v) => ({ ...v, [s.id]: e.target.value }))}
                        className="input-field input-num"
                      />
                      <span className="unit-tag">min</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="day-total-row">
              <span>Total del día</span>
              <span className="mono">{hm(dayTotal)}</span>
            </div>
            <div className="btn-row">
              <button
                className="btn-primary"
                onClick={() => {
                  const clean = {};
                  loggableSubjects.forEach((s) => {
                    const v = parseFloat(values[s.id]);
                    if (v > 0) clean[s.id] = v;
                  });
                  onSaveDay(date, loggableSubjects.map((s) => s.id), clean);
                }}
              >
                Guardar registro
              </button>
              {hasEntryToday && (
                <button className="btn-ghost" onClick={() => onDeleteDay(date, loggableSubjects.map((s) => s.id))}>Eliminar día</button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title" style={{ marginBottom: 0 }}>{historySubjectId === HISTORY_ALL ? "Últimos registros" : "Historial completo"}</div>
          <select className="input-field subject-select" value={historySubjectId} onChange={(e) => setHistorySubjectId(e.target.value)}>
            <option value={HISTORY_ALL}>Histórico (todas las asignaturas)</option>
            {cursoSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {history.length === 0 && <div className="empty-hint">Todavía no hay registros{historySubjectId === HISTORY_ALL ? " en este curso" : " para esta asignatura"}.</div>}
        {history.length > 0 && (
          <>
            <div className="log-list">
              {history.slice(0, visibleCount).map((e) => (
                <button key={historySubjectId === HISTORY_ALL ? `${e.date}-${e.subjectId}` : e.date} className="log-item" onClick={() => setDate(e.date)}>
                  <span className="log-date">{formatShort(e.date)}</span>
                  <span className="log-detail">
                    {historySubjectId === HISTORY_ALL ? (
                      <span className="log-chip" style={{ borderColor: e.subjectColor }}>{e.subjectName}</span>
                    ) : (
                      <span className="log-chip" style={{ borderColor: historySubject?.color }}>{formatMedium(e.date)}</span>
                    )}
                  </span>
                  <span className="log-total mono">{hm(e.minutes)}</span>
                </button>
              ))}
            </div>
            <div className="history-footer">
              <span className="empty-hint" style={{ padding: "8px 0" }}>{history.length} registro(s) en total</span>
              {visibleCount < history.length && (
                <button className="btn-ghost btn-small" onClick={() => setVisibleCount((n) => n + 20)}>Cargar más</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: PANEL (instrumentos)                                          */
/* ------------------------------------------------------------------ */

function PanelTab({ stats }) {
  const maxHoursPerCredit = Math.max(0.5, ...stats.perSubject.map((s) => s.hoursPerCredit), ...stats.perSubject.map((s) => s.target || 0)) * 1.15;
  const maxSessionSub = stats.perSubject.find((s) => s.id === stats.maxSession.subjectId) || null;

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Total registrado" value={hm(stats.globalTotal)} hint={`${stats.totalDaysLogged} días con estudio`} accent="#4FD8EA" />
        <StatCard label="Racha actual" value={`${stats.current} d`} hint={stats.current === 0 ? "sin actividad reciente" : "días seguidos"} accent={stats.current > 0 ? "#3DDC84" : "#8291AC"} />
        <StatCard label="Racha máxima" value={`${stats.longest} d`} hint="mejor marca del curso" accent="#F5A623" />
        <StatCard
          label="Sesión máxima"
          value={maxSessionSub ? hm(stats.maxSession.minutes) : "—"}
          hint={maxSessionSub ? `${maxSessionSub.name} · ${formatShort(stats.maxSession.date)}` : "sin datos"}
          accent="#A78BFA"
        />
        <StatCard
          label="Último registro"
          value={stats.lastActiveDate ? formatShort(stats.lastActiveDate) : "—"}
          hint={stats.daysSinceLast != null ? `hace ${stats.daysSinceLast} día(s)` : ""}
          accent={stats.daysSinceLast != null && stats.daysSinceLast > 5 ? "#FF5C5C" : "#8291AC"}
        />
      </div>

      <div className="panel">
        <div className="panel-title">Instrumentos de esfuerzo — horas por crédito</div>
        <div className="panel-subtitle">La marca vertical indica tu referencia (editable en Asignaturas). Compárala con cursos anteriores para saber si tienes que meterle caña.</div>
        {stats.perSubject.map((s) => (
          <Gauge
            key={s.id}
            label={s.name}
            value={s.hoursPerCredit}
            max={maxHoursPerCredit}
            unit=" h/cr"
            target={s.target}
            color={s.color}
            sub={`${s.pct.toFixed(1)} % del esfuerzo total · ${hm(s.total)} · ${s.daysActive} días activos${s.daysSince != null ? ` · última vez hace ${s.daysSince} d` : ""}`}
          />
        ))}
      </div>

      <div className="panel">
        <div className="panel-title">Detalle por asignatura</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asignatura</th>
                <th>Estado</th>
                <th>Créditos</th>
                <th>Total</th>
                <th>% esfuerzo</th>
                <th>h / crédito</th>
                <th>Prom. día activo</th>
                <th>Sin estudiar</th>
              </tr>
            </thead>
            <tbody>
              {stats.perSubject.map((s) => (
                <tr key={s.id}>
                  <td><span className="dot" style={{ background: s.color }} />{s.name}</td>
                  <td><EstadoBadge estado={s.estado} /></td>
                  <td className="mono">{s.credits}</td>
                  <td className="mono">{hm(s.total)}</td>
                  <td className="mono">{s.pct.toFixed(1)}%</td>
                  <td className="mono">{s.hoursPerCredit.toFixed(2)}</td>
                  <td className="mono">{hm(s.avgActiveDay)}</td>
                  <td className="mono" style={{ color: s.daysSince > 7 ? "#FF5C5C" : s.daysSince > 3 ? "#F5A623" : "#8291AC" }}>
                    {s.daysSince != null ? `${s.daysSince} d` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HoursPerCreditTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#E7ECF5" }}>
      <div style={{ marginBottom: 2 }}>{p.fullName}</div>
      <div className="mono">{p.horasPorCredito.toFixed(2)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: TRAYECTORIA (graficos)                                        */
/* ------------------------------------------------------------------ */

function TrayectoriaTab({ cursoSubjects, entries, stats, curso }) {
  const today = isoToday();
  const isTerminado = !!curso && curso.estado === "terminado";
  const cuatrimestreSplit = curso ? `${curso.endDate.slice(0, 4)}-02-01` : null;
  const [range, setRange] = useState(isTerminado ? "1c" : 90);
  const [trayView, setTrayView] = useState("acumulado");

  useEffect(() => {
    setRange(isTerminado ? "1c" : 90);
  }, [curso?.id, isTerminado]);

  const chartDates = useMemo(() => {
    const all = [...stats.activeDates].sort();
    if (all.length === 0) return [];
    if (isTerminado) {
      if (range === "all") return all;
      if (range === "1c") return all.filter((d) => d < cuatrimestreSplit);
      return all.filter((d) => d >= cuatrimestreSplit);
    }
    if (range === 0) return all;
    const from = addDays(today, -range);
    return all.filter((d) => d >= from);
  }, [stats.activeDates, range, isTerminado, cuatrimestreSplit, today]);

  const areaData = chartDates.map((d) => {
    const row = { date: formatShort(d) };
    cursoSubjects.forEach((s) => { row[s.name] = (entries[d] && entries[d][s.id]) || 0; });
    return row;
  });

  // Días naturales del curso hasta hoy (o hasta que terminó): incluye los
  // días sin estudio como ceros, para que tanto el acumulado como su
  // derivada respeten el tiempo real transcurrido — dos huecos de estudio
  // separados por semanas no deben quedar pegados uno al otro en el eje X.
  const gridEnd = curso.endDate < today ? curso.endDate : today;
  const allDays = [];
  for (let d = curso.startDate; d <= gridEnd; d = addDays(d, 1)) allDays.push(d);

  let acc = 0;
  const cumulativeData = allDays.map((d) => {
    const minutosDia = stats.dailyTotals[d] || 0;
    acc += minutosDia;
    return { date: formatShort(d), horas: +(acc / 60).toFixed(2), horasDia: +(minutosDia / 60).toFixed(2) };
  });

  const pieData = stats.perSubject.filter((s) => s.total > 0).map((s) => ({ name: s.name, value: s.total, color: s.color }));

  const barData = stats.perSubject.map((s) => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name,
    fullName: s.name,
    horasPorCredito: +s.hoursPerCredit.toFixed(2),
    color: s.color,
  }));

  return (
    <div>
      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title" style={{ marginBottom: 0 }}>Minutos diarios por asignatura</div>
          <div className="seg-control">
            {isTerminado ? (
              [
                { key: "1c", label: "1er cuatrimestre" },
                { key: "2c", label: "2º cuatrimestre" },
                { key: "all", label: "Todo el curso" },
              ].map((r) => (
                <button key={r.key} className={`seg-btn ${range === r.key ? "seg-btn-active" : ""}`} onClick={() => setRange(r.key)}>
                  {r.label}
                </button>
              ))
            ) : (
              [30, 90, 0].map((r) => (
                <button key={r} className={`seg-btn ${range === r ? "seg-btn-active" : ""}`} onClick={() => setRange(r)}>
                  {r === 0 ? "Todo el curso" : `${r} d`}
                </button>
              ))
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={areaData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26324A" />
            <XAxis dataKey="date" stroke="#8291AC" fontSize={11} minTickGap={30} />
            <YAxis stroke="#8291AC" fontSize={11} />
            <Tooltip contentStyle={{ background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#E7ECF5" }} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#8291AC" }} />
            {cursoSubjects.map((s) => (
              <Area key={s.id} type="monotone" dataKey={s.name} stackId="1" stroke={s.color} fill={s.color} fillOpacity={0.55} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title-row">
            <div className="panel-title" style={{ marginBottom: 0 }}>
              {trayView === "acumulado" ? "Horas acumuladas en el curso" : "Ritmo diario (derivada)"}
            </div>
            <div className="seg-control">
              <button className={`seg-btn ${trayView === "acumulado" ? "seg-btn-active" : ""}`} onClick={() => setTrayView("acumulado")}>Acumulado</button>
              <button className={`seg-btn ${trayView === "derivada" ? "seg-btn-active" : ""}`} onClick={() => setTrayView("derivada")}>Derivada</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            {trayView === "acumulado" ? (
              <LineChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26324A" />
                <XAxis dataKey="date" stroke="#8291AC" fontSize={11} minTickGap={40} />
                <YAxis stroke="#8291AC" fontSize={11} />
                <Tooltip contentStyle={{ background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#E7ECF5" }} formatter={(v) => [`${v} h`, "Acumulado"]} />
                <Line type="monotone" dataKey="horas" stroke="#4FD8EA" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26324A" />
                <XAxis dataKey="date" stroke="#8291AC" fontSize={11} minTickGap={40} />
                <YAxis stroke="#8291AC" fontSize={11} />
                <Tooltip contentStyle={{ background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#E7ECF5" }} formatter={(v) => [`${v} h`, "Ese día"]} />
                <Bar dataKey="horasDia" fill="#F5A623" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">Distribución del esfuerzo</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#E7ECF5" }} itemStyle={{ color: "#E7ECF5" }} formatter={(v) => hm(v)} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8291AC" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Horas por crédito — comparativa entre asignaturas</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26324A" />
            <XAxis dataKey="name" stroke="#8291AC" fontSize={11} />
            <YAxis stroke="#8291AC" fontSize={11} />
            <Tooltip content={<HoursPerCreditTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="horasPorCredito" radius={[4, 4, 0, 0]}>
              {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: ASIGNATURAS (gestion de cursos y asignaturas)                 */
/* ------------------------------------------------------------------ */

function ApprovalForm({ subject, subjects, onConfirm, onCancel }) {
  const [nota, setNota] = useState("");
  const [cursosNecesarios, setCursosNecesarios] = useState("1");
  const mergedSources = subjects.filter((s) => s.mergedInto === subject.id);
  const activeSources = mergedSources.filter((s) => s.estado === "aprobada");
  const pendingSources = mergedSources.filter((s) => s.estado !== "aprobada");
  const mergeTarget = subject.mergedInto ? subjects.find((s) => s.id === subject.mergedInto) : null;
  return (
    <div>
      <p className="panel-subtitle">
        Vas a marcar <strong>{subject.name}</strong> como aprobada. Nota y cursos necesarios quedan fijos para
        siempre; las horas/crédito, días totales y el desgaste se siguen recalculando siempre con los datos
        actuales, no se congelan.
      </p>
      {activeSources.length > 0 && (
        <p className="panel-subtitle">
          Ya suma las horas de: <strong>{activeSources.map((s) => s.name).join(", ")}</strong> (combinadas, ya aprobada).
        </p>
      )}
      {pendingSources.length > 0 && (
        <p className="panel-subtitle">
          Combinada también con <strong>{pendingSources.map((s) => s.name).join(", ")}</strong>, pero como
          {pendingSources.length === 1 ? " todavía no está aprobada" : " ninguna está aprobada todavía"}, sus horas
          no cuentan aún — se sumarán solas en cuanto la apruebes.
        </p>
      )}
      {mergeTarget && (
        <p className="panel-subtitle">
          Esta asignatura está combinada con <strong>{mergeTarget.name}</strong>: al aprobarla ahora, sus horas
          empezarán a sumarse también a la clasificación de {mergeTarget.name}.
        </p>
      )}
      <div className="field-row">
        <label className="field-label">Nota obtenida</label>
        <input type="number" step="0.1" className="input-field input-num" value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
      <div className="field-row">
        <label className="field-label">Cursos necesarios</label>
        <input type="number" min="1" step="1" className="input-field input-num" value={cursosNecesarios} onChange={(e) => setCursosNecesarios(e.target.value)} />
      </div>
      <div className="btn-row">
        <button className="btn-primary" onClick={() => onConfirm({ nota, cursosNecesarios })}>Confirmar aprobación</button>
        <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function AsignaturasTab({ subjects, cursoSubjects, entries, onAddSubject, onDeleteSubject, onUpdateSubject, onChangeEstado, onApprove, cursos, activeCursoId, onSelectCurso, onAddCurso, onRemoveCurso, onToggleCursoEstado }) {
  const [newSubject, setNewSubject] = useState({ name: "", credits: "" });
  const [newCurso, setNewCurso] = useState({ name: "", startDate: "", endDate: "" });
  const [approvingId, setApprovingId] = useState(null);

  function addSubject() {
    if (!newSubject.name.trim() || !newSubject.credits) return;
    onAddSubject(newSubject.name.trim(), parseFloat(newSubject.credits));
    setNewSubject({ name: "", credits: "" });
  }

  function updateNewCursoName(name) {
    const inferred = inferCursoRange(name);
    setNewCurso((v) => ({
      ...v,
      name,
      startDate: inferred ? inferred.startDate : v.startDate,
      endDate: inferred ? inferred.endDate : v.endDate,
    }));
  }

  function addCurso() {
    if (!newCurso.name.trim() || !newCurso.startDate || !newCurso.endDate) return;
    onAddCurso(newCurso.name.trim(), newCurso.startDate, newCurso.endDate);
    setNewCurso({ name: "", startDate: "", endDate: "" });
  }

  const approvingSubject = approvingId ? subjects.find((s) => s.id === approvingId) : null;
  const hasEntries = (subjectId) => Object.values(entries).some((day) => day[subjectId] > 0);
  const curso = cursos.find((c) => c.id === activeCursoId);

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Cursos académicos</div>
        <div className="panel-subtitle">
          Cada curso es solo un rango de fechas — el registro de una asignatura se muestra bajo el curso al que
          corresponda su fecha, automáticamente, sin que tengas que vincular nada a mano.
        </div>
        <div className="curso-list">
          {cursos.map((c) => (
            <div key={c.id} className={`curso-chip ${c.id === activeCursoId ? "curso-chip-active" : ""}`}>
              <button onClick={() => onSelectCurso(c.id)} title={`${c.startDate} → ${c.endDate}`}>
                {c.name}
                {c.estado === "terminado" && <span className="curso-badge">terminado</span>}
              </button>
              {cursos.length > 1 && (
                <span className="curso-remove" onClick={() => onRemoveCurso(c.id)}>×</span>
              )}
            </div>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 12, alignItems: "center" }}>
          <input
            className="input-field"
            placeholder="Ej. 2026-2027"
            value={newCurso.name}
            onChange={(e) => updateNewCursoName(e.target.value)}
          />
          <input type="date" className="input-field" value={newCurso.startDate} onChange={(e) => setNewCurso((v) => ({ ...v, startDate: e.target.value }))} />
          <span className="gauge-sub" style={{ margin: 0 }}>→</span>
          <input type="date" className="input-field" value={newCurso.endDate} onChange={(e) => setNewCurso((v) => ({ ...v, endDate: e.target.value }))} />
          <button
            className="btn-primary"
            onClick={addCurso}
            disabled={!newCurso.name.trim() || !newCurso.startDate || !newCurso.endDate}
            style={!newCurso.name.trim() || !newCurso.startDate || !newCurso.endDate ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            Añadir curso
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title" style={{ marginBottom: 0 }}>Asignaturas de {curso?.name}</div>
          {curso && (
            <button className="btn-ghost btn-small" onClick={() => onToggleCursoEstado(curso.id)}>
              {curso.estado === "terminado" ? "Marcar como en curso" : "Marcar como terminado"}
            </button>
          )}
        </div>
        <div className="panel-subtitle">
          Si esta asignatura convalida o equivale a otra con nombre distinto que cursaste antes, puedes combinarla con
          ella desde "Combinar con". Sus horas, días y cursos necesarios se sumarán a la asignatura que finalmente apruebes.
          {curso?.estado === "terminado"
            ? " Este curso está marcado como terminado: en Trayectoria se muestra por cuatrimestres en vez de por días."
            : " Este curso está en marcha: en Trayectoria se muestra por los últimos 30/90 días."}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asignatura</th>
                <th>Estado</th>
                <th>Créditos</th>
                <th>Referencia h/crédito</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cursoSubjects.map((s) => {
                const mergeOptions = subjects.filter((o) => o.id !== s.id && !o.mergedInto);
                const hasOwnSources = subjects.some((o) => o.mergedInto === s.id);
                const deletable = !hasEntries(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="dot" style={{ background: s.color }} />
                      <input
                        className="input-field input-inline"
                        value={s.name}
                        onChange={(e) => onUpdateSubject(s.id, { name: e.target.value })}
                      />
                      {!hasOwnSources && (
                        <select
                          className="input-field input-inline merge-select"
                          value={s.mergedInto || ""}
                          onChange={(e) => onUpdateSubject(s.id, { mergedInto: e.target.value || null })}
                        >
                          <option value="">No combinar (cuenta por separado)</option>
                          {mergeOptions.map((o) => (
                            <option key={o.id} value={o.id}>Combinada con: {o.name}</option>
                          ))}
                        </select>
                      )}
                      {hasOwnSources && (() => {
                        const sources = subjects.filter((o) => o.mergedInto === s.id);
                        const active = sources.filter((o) => o.estado === "aprobada");
                        const pending = sources.filter((o) => o.estado !== "aprobada");
                        return (
                          <div style={{ marginTop: 4 }}>
                            {active.length > 0 && (
                              <div className="gauge-sub">Combinada con: {active.map((o) => o.name).join(", ")}</div>
                            )}
                            {pending.length > 0 && (
                              <div className="gauge-sub" style={{ color: "var(--amber)" }}>
                                Combinada con (pendiente, no cuenta aún): {pending.map((o) => o.name).join(", ")}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <select
                        className="input-field input-inline estado-select"
                        value={s.estado}
                        onChange={(e) => {
                          if (e.target.value === "aprobada") setApprovingId(s.id);
                          else onChangeEstado(s.id, e.target.value);
                        }}
                      >
                        <option value="en_curso">En curso</option>
                        <option value="suspendida">Suspendida</option>
                        <option value="aprobada">Aprobada</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number" min="1" step="1" className="input-field input-inline input-num"
                        value={s.credits}
                        onChange={(e) => onUpdateSubject(s.id, { credits: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        type="number" min="0" step="0.1" className="input-field input-inline input-num"
                        placeholder="opcional"
                        value={s.target ?? ""}
                        onChange={(e) => onUpdateSubject(s.id, { target: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      />
                    </td>
                    <td>
                      <button
                        className="btn-ghost btn-small"
                        onClick={() => deletable && onDeleteSubject(s.id)}
                        disabled={!deletable}
                        title={deletable ? undefined : "No se puede eliminar: ya tiene registros guardados"}
                        style={!deletable ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <input className="input-field" placeholder="Nombre de la asignatura" value={newSubject.name} onChange={(e) => setNewSubject((v) => ({ ...v, name: e.target.value }))} />
          <input className="input-field input-num" type="number" min="1" placeholder="Créditos" value={newSubject.credits} onChange={(e) => setNewSubject((v) => ({ ...v, credits: e.target.value }))} />
          <button className="btn-primary" onClick={addSubject}>Añadir asignatura nueva</button>
        </div>
      </div>

      {approvingSubject && (
        <Modal title="Marcar asignatura como aprobada" onClose={() => setApprovingId(null)}>
          <ApprovalForm
            subject={approvingSubject}
            subjects={subjects}
            onCancel={() => setApprovingId(null)}
            onConfirm={({ nota, cursosNecesarios }) => { onApprove(approvingSubject.id, { nota, cursosNecesarios }); setApprovingId(null); }}
          />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: DESGASTE (peor tramo, normalizado y personal)                 */
/* ------------------------------------------------------------------ */

const WEAR_FACTOR_INFO = {
  intensidad: {
    label: "Intensidad",
    explain: "Minutos de media que estudiaste cada día activo, durante el tramo más exigente de esta asignatura.",
    raw: (f) => `${f.intensidad.toFixed(0)} min/día`,
  },
  duracion: {
    label: "Duración",
    explain: "Cuántos días activos duró ese tramo — indica si fue un sprint corto o un esfuerzo sostenido en el tiempo.",
    raw: (f) => `${f.duracion} días`,
  },
  compresion: {
    label: "Compresión",
    explain: "Qué porcentaje de los días de ese tramo estudiaste sin fallar ninguno — cuanto más alto, menos respiro hubo.",
    raw: (f) => `${(f.compresion * 100).toFixed(0)}%`,
  },
  racha: {
    label: "Racha interna",
    explain: "El mayor número de días seguidos, sin ningún descanso, dentro de ese tramo.",
    raw: (f) => `${f.racha} días`,
  },
};

function DesgasteCard({ subject, desgaste, bare }) {
  const isEnCurso = subject.estado !== "aprobada";
  const wb = desgaste.worstBlock;
  return (
    <div className={bare ? "" : "panel wear-card"}>
      <div className="wear-card-head">
        <div>
          <span className="dot" style={{ background: subject.color }} />
          <strong>{subject.name}</strong>
          {isEnCurso && <span className="wear-provisional">vista previa, aún sin aprobar</span>}
        </div>
        <EstadoBadge estado={subject.estado} />
      </div>
      {!desgaste.comparable && (
        <div className="empty-hint">No comparable — datos insuficientes (ningún tramo de ≥3 días activos todavía).</div>
      )}
      {desgaste.comparable && (
        <>
          <div className="wear-index-row">
            <span className="wear-index-value">{desgaste.indice.toFixed(1)}</span>
            <div>
              <span className={`wear-label wear-label-${desgaste.etiqueta.toLowerCase()}`}>{desgaste.etiqueta}</span>
              {wb && (
                <div className="wear-index-sub">
                  Tu peor tramo fue del {formatShort(wb.first)} al {formatShort(wb.last)}: {wb.dias_activos} días
                  estudiando una media de {wb.intensidad.toFixed(0)} min/día.
                </div>
              )}
            </div>
          </div>
          <div className="wear-factors">
            {Object.entries(WEAR_FACTOR_INFO).map(([key, info]) => (
              <div className="wear-factor-card" key={key}>
                <div className="wear-factor-label">{info.label}</div>
                <div className="wear-factor-raw mono">{info.raw(desgaste.rawFactors)}</div>
                <div className="wear-factor-explain">{info.explain}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Para cada asignatura "oficial" (no fusionada dentro de otra), calcula el
 * desgaste de ella misma y el de cualquier asignatura combinada con
 * "Combinar con", y se queda con el mayor de los dos — p. ej. si Calcolo
 * Numerico está combinada con Métodos Matemáticos y su tramo fue más duro,
 * la clasificación general muestra el desgaste de Calcolo Numerico bajo
 * el nombre de Métodos Matemáticos. */
function buildDesgasteRanking(subjects, entries) {
  const targets = subjects.filter((s) => !s.mergedInto);
  return targets.map((target) => {
    const members = [target, ...subjects.filter((s) => s.mergedInto === target.id)];
    const computed = members.map((m) => ({ subject: m, desgaste: computeDesgaste(m.id, entries) }));
    const ranked = computed.filter((c) => c.desgaste.comparable);
    const best = ranked.length > 0 ? ranked.reduce((a, b) => (b.desgaste.indice > a.desgaste.indice ? b : a)) : null;
    return { target, best };
  }).sort((a, b) => {
    if (!a.best && !b.best) return a.target.name.localeCompare(b.target.name);
    if (!a.best) return 1;
    if (!b.best) return -1;
    return b.best.desgaste.indice - a.best.desgaste.indice;
  });
}

function DesgasteRankingTab({ subjects, entries }) {
  const [detailId, setDetailId] = useState(null);
  const groups = useMemo(() => buildDesgasteRanking(subjects, entries), [subjects, entries]);
  const detailGroup = detailId ? groups.find((g) => g.target.id === detailId) : null;

  return (
    <div>
      <div className="panel-subtitle" style={{ margin: "0 0 16px", padding: "0 4px" }}>
        Todas tus asignaturas, de la más a la menos dura. Si una asignatura está combinada con otra distinta
        ("Combinar con"), se muestra el mayor desgaste entre las dos — p. ej. si Calcolo Numerico (combinada con
        Métodos Matemáticos) tuvo el tramo más duro, es su número el que aparece aquí.
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Asignatura</th>
                <th>Estado</th>
                <th>Desgaste</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => (
                <tr key={g.target.id} className={g.best ? "clickable-row" : ""} onClick={() => g.best && setDetailId(g.target.id)}>
                  <td className="mono">{i + 1}</td>
                  <td>
                    <span className="dot" style={{ background: g.target.color }} />
                    {g.target.name}
                    {g.best && g.best.subject.id !== g.target.id && (
                      <div className="gauge-sub">Desgaste mostrado: {g.best.subject.name}</div>
                    )}
                  </td>
                  <td><EstadoBadge estado={g.target.estado} /></td>
                  <td>
                    {g.best ? (
                      <span className={`wear-label wear-label-${g.best.desgaste.etiqueta.toLowerCase()}`}>
                        {g.best.desgaste.indice.toFixed(1)} · {g.best.desgaste.etiqueta}
                      </span>
                    ) : (
                      <span className="mono" style={{ color: "var(--text-dim)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailGroup && detailGroup.best && (
        <Modal title={detailGroup.target.name} onClose={() => setDetailId(null)} wide>
          <DesgasteCard subject={detailGroup.best.subject} desgaste={detailGroup.best.desgaste} bare />
        </Modal>
      )}
    </div>
  );
}

function DesgasteTab({ cursoSubjects, subjects, entries }) {
  const [view, setView] = useState("curso");

  const rows = useMemo(() => {
    return cursoSubjects.map((s) => ({ subject: s, desgaste: computeDesgaste(s.id, entries) })).sort((a, b) => {
      const ai = a.desgaste.comparable ? a.desgaste.indice : -2;
      const bi = b.desgaste.comparable ? b.desgaste.indice : -2;
      if (a.subject.estado === "aprobada" && b.subject.estado !== "aprobada") return -1;
      if (b.subject.estado === "aprobada" && a.subject.estado !== "aprobada") return 1;
      return bi - ai;
    });
  }, [cursoSubjects, subjects, entries]);

  return (
    <div>
      <div className="seg-control" style={{ marginBottom: 16, display: "inline-flex" }}>
        <button className={`seg-btn ${view === "curso" ? "seg-btn-active" : ""}`} onClick={() => setView("curso")}>Por curso</button>
        <button className={`seg-btn ${view === "ranking" ? "seg-btn-active" : ""}`} onClick={() => setView("ranking")}>Clasificación de desgaste</button>
      </div>

      {view === "ranking" && <DesgasteRankingTab subjects={subjects} entries={entries} />}

      {view === "curso" && (
        rows.length === 0 ? (
          <div className="panel"><div className="empty-hint">Todavía no hay asignaturas en este curso.</div></div>
        ) : (
          <div>
            <div className="panel-subtitle" style={{ margin: "0 0 16px", padding: "0 4px" }}>
              Mide el tramo de estudio más exigente de cada asignatura de este curso, normalizado contra un tope fijo
              por factor (Intensidad 300 min/día, Duración 18 días, Compresión 90%, Racha interna 10 días), así que el
              índice de una asignatura no cambia según apruebes otras. Para las que siguen en curso se muestra además
              una vista previa de lo que saldría si las aprobaras hoy.
            </div>
            {rows.map(({ subject, desgaste }) => (
              <DesgasteCard key={subject.id} subject={subject} desgaste={desgaste} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: CLASIFICACIÓN HISTÓRICA (tabla comparativa, sin normalizar)    */
/* ------------------------------------------------------------------ */

const CLASIF_COLUMNS = [
  { key: "name", label: "Asignatura" },
  { key: "horasPorCredito", label: "Horas/crédito" },
  { key: "horasTotales", label: "Horas totales" },
  { key: "cursosNecesarios", label: "Cursos necesarios" },
  { key: "nota", label: "Nota" },
];

function ClasificacionDetail({ subject, subjects, entries }) {
  const f = subject.frozen;
  const c = computeClassification(subject, entries, subjects);
  const mergedSources = subjects.filter((s) => s.mergedInto === subject.id);
  const activeSources = mergedSources.filter((s) => s.estado === "aprobada");
  const pendingSources = mergedSources.filter((s) => s.estado !== "aprobada");

  const wearMembers = [subject, ...activeSources];
  const wearComputed = wearMembers.map((m) => ({ subject: m, desgaste: computeDesgaste(m.id, entries) }));
  const wearRanked = wearComputed.filter((w) => w.desgaste.comparable);
  const wearBest = wearRanked.length > 0
    ? wearRanked.reduce((a, b) => (b.desgaste.indice > a.desgaste.indice ? b : a))
    : wearComputed[0];
  const d = wearBest.desgaste;
  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <StatCard label="Horas / crédito" value={c.horasPorCredito.toFixed(2)} accent="#4FD8EA" />
        <StatCard label="Días totales" value={`${c.diasTotales} d`} accent="#F5A623" />
        <StatCard label="Cursos necesarios" value={f.cursosNecesarios ?? "—"} accent="#A78BFA" />
        <StatCard label="Nota" value={f.nota ?? "—"} accent="#3DDC84" />
      </div>
      {activeSources.length > 0 && (
        <div className="gauge-sub" style={{ padding: "0 4px 4px" }}>
          Combinada con: {activeSources.map((s) => s.name).join(", ")}
        </div>
      )}
      {pendingSources.length > 0 && (
        <div className="gauge-sub" style={{ padding: "0 4px 4px", color: "var(--amber)" }}>
          Pendiente de combinar (aún no aprobada, no cuenta todavía): {pendingSources.map((s) => s.name).join(", ")}
        </div>
      )}
      <div className="panel" style={{ marginTop: 4 }}>
        <div className="panel-title">Desgaste</div>
        {wearBest.subject.id !== subject.id && (
          <div className="gauge-sub" style={{ marginBottom: 6 }}>
            Desgaste mostrado: {wearBest.subject.name} (la que más costó)
          </div>
        )}
        {!d.comparable && <div className="empty-hint">No comparable — datos insuficientes.</div>}
        {d.comparable && (
          <>
            <div className="wear-index-row">
              <span className="wear-index-value">{d.indice.toFixed(1)}</span>
              <div>
                <span className={`wear-label wear-label-${d.etiqueta.toLowerCase()}`}>{d.etiqueta}</span>
              </div>
            </div>
            <div className="wear-factors">
              {Object.entries(WEAR_FACTOR_INFO).map(([key, info]) => (
                <div className="wear-factor-card" key={key}>
                  <div className="wear-factor-label">{info.label}</div>
                  <div className="wear-factor-raw mono">{info.raw(d.rawFactors)}</div>
                  <div className="wear-factor-explain">{info.explain}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="gauge-sub" style={{ padding: "0 4px" }}>
        Inicio: {c.fechaInicio ? formatMedium(c.fechaInicio) : "—"} · Aprobada: {formatMedium(f.fechaAprobacion)}
      </div>
    </div>
  );
}

function ClasificacionTab({ subjects, entries }) {
  const [sortKey, setSortKey] = useState("horasPorCredito");
  const [sortDir, setSortDir] = useState("desc");
  const [detailId, setDetailId] = useState(null);

  const approved = subjects.filter((s) => s.estado === "aprobada" && s.frozen);

  const rows = useMemo(() => {
    const list = approved.map((s) => {
      const c = computeClassification(s, entries, subjects);
      return {
        id: s.id, name: s.name, color: s.color,
        horasPorCredito: c.horasPorCredito,
        horasTotales: +(c.minutosTotales / 60).toFixed(1),
        cursosNecesarios: s.frozen.cursosNecesarios ?? 0,
        nota: s.frozen.nota ?? 0,
      };
    });
    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [approved, entries, subjects, sortKey, sortDir]);

  function toggleSort(key) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const detailSubject = detailId ? subjects.find((s) => s.id === detailId) : null;

  if (approved.length === 0) {
    return <div className="panel"><div className="empty-hint">Todavía no hay asignaturas aprobadas. Márcalas como aprobadas desde la pestaña Asignaturas para verlas aquí.</div></div>;
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Clasificación histórica</div>
        <div className="panel-subtitle">Cifras absolutas, sin normalizar — la forma más objetiva de comparar cuánto costó cada asignatura. Toca una fila para ver la ficha completa.</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {CLASIF_COLUMNS.map((c) => (
                  <th key={c.key} className="sortable-th" onClick={() => toggleSort(c.key)}>
                    {c.label}{sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clickable-row" onClick={() => setDetailId(r.id)}>
                  <td><span className="dot" style={{ background: r.color }} />{r.name}</td>
                  <td className="mono">{r.horasPorCredito.toFixed(2)}</td>
                  <td className="mono">{r.horasTotales.toFixed(1)}</td>
                  <td className="mono">{r.cursosNecesarios || "—"}</td>
                  <td className="mono">{r.nota || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailSubject && (
        <Modal title={detailSubject.name} onClose={() => setDetailId(null)} wide>
          <ClasificacionDetail subject={detailSubject} subjects={subjects} entries={entries} />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CONEXIÓN CON GOOGLE SHEETS (Apps Script) — YA NO SE USA            */
/*  Se deja sin borrar como red de seguridad durante la migración a    */
/*  Supabase (ver supabaseData.js). Una vez confirmado en producción   */
/*  que todo funciona bien con Supabase, se puede eliminar este bloque */
/*  y las variables VITE_APPS_SCRIPT_*.                                */
/* ------------------------------------------------------------------ */

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
const APPS_SCRIPT_TOKEN = import.meta.env.VITE_APPS_SCRIPT_TOKEN;
const DISABLE_CLOUD_SAVE = import.meta.env.VITE_DISABLE_CLOUD_SAVE === "true";

async function cloudLoad() {
  const res = await fetch(`${APPS_SCRIPT_URL}?token=${encodeURIComponent(APPS_SCRIPT_TOKEN)}`);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.value;
}

async function cloudSave(dataObj) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: APPS_SCRIPT_TOKEN, value: JSON.stringify(dataObj) }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

/* ------------------------------------------------------------------ */
/*  APP PRINCIPAL                                                      */
/* ------------------------------------------------------------------ */

/** Una cuenta recién creada no tiene ningún curso todavía (antes,
 * buildDefaultData() sembraba uno automáticamente en el blob de Google
 * Sheets; con Supabase cada cuenta arranca vacía). Sin esto, la app se
 * queda cargando para siempre porque no hay ningún curso que seleccionar. */
function WelcomeCreateCurso({ onCreate, onSignOut, email }) {
  const [newCurso, setNewCurso] = useState({ name: "", startDate: "", endDate: "" });

  function updateName(name) {
    const inferred = inferCursoRange(name);
    setNewCurso((v) => ({
      ...v,
      name,
      startDate: inferred ? inferred.startDate : v.startDate,
      endDate: inferred ? inferred.endDate : v.endDate,
    }));
  }

  const canCreate = newCurso.name.trim() && newCurso.startDate && newCurso.endDate;

  return (
    <div className="app-shell app-loading">
      <style>{CSS}</style>
      <div className="panel auth-card">
        <div className="panel-title">¡Bienvenido!</div>
        <div className="panel-subtitle">Antes de empezar, crea tu primer curso académico (solo un rango de fechas).</div>
        <div className="field-row">
          <label className="field-label">Nombre</label>
          <input className="input-field" placeholder="Ej. 2025-2026" value={newCurso.name} onChange={(e) => updateName(e.target.value)} />
        </div>
        <div className="field-row">
          <label className="field-label">Inicio</label>
          <input type="date" className="input-field" value={newCurso.startDate} onChange={(e) => setNewCurso((v) => ({ ...v, startDate: e.target.value }))} />
        </div>
        <div className="field-row">
          <label className="field-label">Fin</label>
          <input type="date" className="input-field" value={newCurso.endDate} onChange={(e) => setNewCurso((v) => ({ ...v, endDate: e.target.value }))} />
        </div>
        <div className="btn-row">
          <button
            className="btn-primary"
            disabled={!canCreate}
            onClick={() => onCreate(newCurso.name.trim(), newCurso.startDate, newCurso.endDate)}
          >
            Crear curso
          </button>
          <button className="btn-ghost" onClick={onSignOut}>Cerrar sesión ({email})</button>
        </div>
      </div>
    </div>
  );
}

export default function App({ session, profile, onSignOut } = {}) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("bitacora");
  const [cloudError, setCloudError] = useState(null);
  const userId = session.user.id;

  useEffect(() => {
    (async () => {
      try {
        setData(await loadUserData(userId));
        setCloudError(null);
      } catch (e) {
        setCloudError(String((e && e.message) || e));
      }
    })();
  }, [userId]);

  // Cada acción del usuario (guardar un día, añadir una asignatura, etc.)
  // escribe directamente en Supabase en el momento — ya no hay un guardado
  // automático de "todo el bloque" cada pocos segundos como con Google
  // Sheets. Si DISABLE_CLOUD_SAVE está activo (solo en local, para pruebas),
  // se salta la escritura real y solo se actualiza la vista.
  async function withCloudWrite(fn) {
    if (DISABLE_CLOUD_SAVE) return;
    try {
      await fn();
      setCloudError(null);
    } catch (e) {
      setCloudError(String((e && e.message) || e));
    }
  }

  const curso = useMemo(() => data && data.cursos.find((c) => c.id === data.activeCursoId), [data]);
  const cursoEntries = useMemo(
    () => (data && curso ? entriesInRange(data.entries, curso.startDate, curso.endDate) : {}),
    [data, curso]
  );
  const cursoSubjects = useMemo(
    () => (data && curso ? subjectsWithActivityInRange(data.subjects, data.entries, curso.startDate, curso.endDate) : []),
    [data, curso]
  );
  const cursoSubjectsForManagement = useMemo(
    () => (data && curso ? subjectsForRegisterInCurso(data.subjects, data.entries, curso) : []),
    [data, curso]
  );
  const loggableSubjects = useMemo(
    () => cursoSubjectsForManagement.filter((s) => s.estado !== "aprobada"),
    [cursoSubjectsForManagement]
  );
  const stats = useMemo(() => (data && curso ? computeStats(cursoSubjects, cursoEntries) : null), [data, curso, cursoSubjects, cursoEntries]);

  function handleSaveDay(date, loggableIds, values) {
    setData((d) => {
      const nextDay = { ...(d.entries[date] || {}) };
      loggableIds.forEach((id) => delete nextDay[id]);
      Object.entries(values).forEach(([id, v]) => { nextDay[id] = v; });
      const entries = { ...d.entries };
      if (Object.keys(nextDay).length === 0) delete entries[date];
      else entries[date] = nextDay;
      return { ...d, entries };
    });
    withCloudWrite(() => saveDayEntries(userId, date, loggableIds, values));
  }

  function handleDeleteDay(date, loggableIds) {
    setData((d) => {
      const nextDay = { ...(d.entries[date] || {}) };
      loggableIds.forEach((id) => delete nextDay[id]);
      const entries = { ...d.entries };
      if (Object.keys(nextDay).length === 0) delete entries[date];
      else entries[date] = nextDay;
      return { ...d, entries };
    });
    withCloudWrite(() => deleteDayEntries(userId, date, loggableIds));
  }

  // Añadir asignatura/curso necesita el id real que genera Supabase antes
  // de poder guardarlo en el estado local (los registros de estudio se
  // referencian a ese id), así que aquí sí se espera a la respuesta del
  // servidor en vez de actualizar la vista primero.
  async function handleAddSubject(name, credits) {
    const color = PALETTE[(data?.subjects.length || 0) % PALETTE.length];
    const originCursoId = curso?.id ?? null;
    if (DISABLE_CLOUD_SAVE) {
      const newSub = {
        id: uid("sub"), name, credits, target: null, color,
        estado: "en_curso", mergedInto: null, originCursoId, frozen: null,
      };
      setData((d) => ({ ...d, subjects: [...d.subjects, newSub] }));
      return;
    }
    try {
      const newSub = await insertSubject(userId, { name, credits, color, originCursoId });
      setData((d) => ({ ...d, subjects: [...d.subjects, newSub] }));
      setCloudError(null);
    } catch (e) {
      setCloudError(String((e && e.message) || e));
    }
  }

  function handleDeleteSubject(subjectId) {
    const hasEntries = Object.values(data.entries).some((day) => day[subjectId] > 0);
    if (hasEntries) return;
    setData((d) => ({ ...d, subjects: d.subjects.filter((s) => s.id !== subjectId) }));
    withCloudWrite(() => deleteSubject(userId, subjectId));
  }

  function handleUpdateSubject(subjectId, patch) {
    setData((d) => ({ ...d, subjects: d.subjects.map((s) => (s.id === subjectId ? { ...s, ...patch } : s)) }));
    withCloudWrite(() => updateSubject(userId, subjectId, patch));
  }

  function handleChangeEstado(subjectId, estado) {
    setData((d) => ({
      ...d,
      subjects: d.subjects.map((s) => (s.id === subjectId ? { ...s, estado, frozen: estado === "aprobada" ? s.frozen : null } : s)),
    }));
    withCloudWrite(() => updateSubjectEstado(userId, subjectId, estado));
  }

  function handleApprove(subjectId, { nota, cursosNecesarios }) {
    const subject = data.subjects.find((s) => s.id === subjectId);
    const approved = freezeApproval(subject, { nota, cursosNecesarios });
    setData((d) => ({ ...d, subjects: d.subjects.map((s) => (s.id === subjectId ? approved : s)) }));
    withCloudWrite(() => approveSubject(userId, subjectId, approved.frozen));
  }

  async function handleAddCurso(name, startDate, endDate) {
    if (DISABLE_CLOUD_SAVE) {
      const id = uid("curso");
      setData((d) => ({ ...d, activeCursoId: id, cursos: [...d.cursos, { id, name, startDate, endDate, estado: "en_curso" }] }));
      return;
    }
    try {
      const newCurso = await insertCurso(userId, { name, startDate, endDate });
      setData((d) => ({ ...d, activeCursoId: newCurso.id, cursos: [...d.cursos, newCurso] }));
      setCloudError(null);
    } catch (e) {
      setCloudError(String((e && e.message) || e));
    }
  }

  function handleToggleCursoEstado(id) {
    const target = data.cursos.find((c) => c.id === id);
    const nextEstado = target?.estado === "terminado" ? "en_curso" : "terminado";
    setData((d) => ({ ...d, cursos: d.cursos.map((c) => (c.id === id ? { ...c, estado: nextEstado } : c)) }));
    withCloudWrite(() => updateCursoEstado(userId, id, nextEstado));
  }

  function handleRemoveCurso(id) {
    if (data.cursos.length === 1) return;
    setData((d) => {
      if (d.cursos.length === 1) return d;
      const cursos = d.cursos.filter((c) => c.id !== id);
      return { ...d, activeCursoId: d.activeCursoId === id ? cursos[0].id : d.activeCursoId, cursos };
    });
    withCloudWrite(() => deleteCurso(userId, id));
  }

  if (data && data.cursos.length === 0) {
    return <WelcomeCreateCurso onCreate={handleAddCurso} onSignOut={onSignOut} email={session.user.email} />;
  }

  if (!data || !curso || !stats) {
    return (
      <div className="app-shell app-loading">
        <style>{CSS}</style>
        <div className="mono" style={{ color: "#8291AC" }}>Cargando bitácora…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <style>{CSS}</style>
      <header className="app-header">
        <div>
          <div className="app-eyebrow">Panel de control · estudio</div>
          <h1 className="app-title">Bitácora de vuelo</h1>
        </div>
        <div className="header-right">
          <select
            className="curso-select"
            value={curso.id}
            onChange={(e) => setData((d) => ({ ...d, activeCursoId: e.target.value }))}
          >
            {data.cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {cloudError && <span className="cloud-error" title={cloudError}>⚠ nube: {cloudError}</span>}
          {session && (
            <div className="account-box">
              <span className="account-email">{session.user.email}</span>
              <button className="btn-ghost btn-small" onClick={onSignOut}>Cerrar sesión</button>
            </div>
          )}
        </div>
      </header>

      {DISABLE_CLOUD_SAVE && (
        <div className="preview-banner">
          Vista previa de solo lectura: los cambios que hagas aquí no se guardan en la nube compartida.
        </div>
      )}

      <nav className="tab-bar">
        <Tab id="bitacora" active={tab === "bitacora"} onClick={setTab}>Bitácora</Tab>
        <Tab id="panel" active={tab === "panel"} onClick={setTab}>Panel</Tab>
        <Tab id="trayectoria" active={tab === "trayectoria"} onClick={setTab}>Trayectoria</Tab>
        <Tab id="desgaste" active={tab === "desgaste"} onClick={setTab}>Desgaste</Tab>
        <Tab id="clasificacion" active={tab === "clasificacion"} onClick={setTab}>Clasificación</Tab>
        <Tab id="asignaturas" active={tab === "asignaturas"} onClick={setTab}>Asignaturas</Tab>
      </nav>

      <main className="app-main">
        {tab === "bitacora" && (
          <BitacoraTab
            cursoSubjects={cursoSubjects}
            loggableSubjects={loggableSubjects}
            entries={cursoEntries}
            onSaveDay={handleSaveDay}
            onDeleteDay={handleDeleteDay}
            curso={curso}
          />
        )}
        {tab === "panel" && <PanelTab stats={stats} />}
        {tab === "trayectoria" && <TrayectoriaTab cursoSubjects={cursoSubjects} entries={cursoEntries} stats={stats} curso={curso} />}
        {tab === "desgaste" && <DesgasteTab cursoSubjects={cursoSubjects} subjects={data.subjects} entries={data.entries} />}
        {tab === "clasificacion" && <ClasificacionTab subjects={data.subjects} entries={data.entries} />}
        {tab === "asignaturas" && (
          <AsignaturasTab
            subjects={data.subjects}
            cursoSubjects={cursoSubjectsForManagement}
            entries={data.entries}
            cursos={data.cursos}
            activeCursoId={data.activeCursoId}
            onSelectCurso={(id) => setData((d) => ({ ...d, activeCursoId: id }))}
            onAddSubject={handleAddSubject}
            onDeleteSubject={handleDeleteSubject}
            onUpdateSubject={handleUpdateSubject}
            onChangeEstado={handleChangeEstado}
            onApprove={handleApprove}
            onAddCurso={handleAddCurso}
            onRemoveCurso={handleRemoveCurso}
            onToggleCursoEstado={handleToggleCursoEstado}
          />
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ESTILOS                                                             */
/* ------------------------------------------------------------------ */

export const CSS = `
  :root {
    --bg: #0A0F1C;
    --panel: #121A2B;
    --panel-2: #1A2438;
    --border: #26324A;
    --text: #E7ECF5;
    --text-dim: #8291AC;
    --cyan: #4FD8EA;
    --amber: #F5A623;
    --green: #3DDC84;
    --red: #FF5C5C;
    --purple: #A78BFA;
  }
  .app-shell {
    background: radial-gradient(1200px 600px at 50% -10%, #101B30 0%, var(--bg) 60%);
    min-height: 100vh;
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 20px 16px 60px;
  }
  .app-loading { display: flex; align-items: center; justify-content: center; }
  .mono { font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace; }
  .app-header {
    max-width: 1080px; margin: 0 auto 18px; display: flex; justify-content: space-between;
    align-items: flex-end; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--border); padding-bottom: 16px;
  }
  .app-eyebrow {
    font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--cyan); margin-bottom: 4px;
  }
  .app-title { font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
  .header-right { display: flex; align-items: center; gap: 10px; }
  .account-box { display: flex; align-items: center; gap: 8px; }
  .account-email { font-size: 12px; color: var(--text-dim); }
  .auth-card { max-width: 360px; width: 100%; }
  .password-field { position: relative; flex: 1; }
  .password-field .input-field { width: 100%; padding-right: 38px; }
  .password-toggle {
    position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; font-size: 15px; padding: 4px 6px; line-height: 1;
  }
  .auth-error { color: var(--red); font-size: 13px; margin: 8px 0; }
  .auth-info { color: var(--cyan); font-size: 13px; margin: 8px 0; }
  .auth-link {
    display: block; background: none; border: none; color: var(--text-dim); font-size: 12px;
    text-decoration: underline; cursor: pointer; margin-top: 12px; padding: 0;
  }
  .auth-link:hover { color: var(--cyan); }
  .cloud-error {
    font-size: 10.5px; color: var(--red); background: rgba(255,92,92,0.1); border: 1px solid rgba(255,92,92,0.3);
    border-radius: 20px; padding: 4px 10px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .curso-select {
    background: var(--panel); border: 1px solid var(--border); color: var(--text); border-radius: 8px;
    padding: 8px 10px; font-size: 13px; font-family: ui-monospace, monospace;
  }
  @media (max-width: 640px) {
    .header-right { width: 100%; }
  }

  .preview-banner {
    max-width: 1080px; margin: 0 auto 16px; background: rgba(245,166,35,0.1); border: 1px solid rgba(245,166,35,0.35);
    color: var(--amber); font-size: 12.5px; padding: 10px 14px; border-radius: 10px;
  }

  .tab-bar { max-width: 1080px; margin: 0 auto 20px; display: flex; gap: 6px; flex-wrap: wrap; }
  .tab-btn {
    font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
    background: var(--panel); border: 1px solid var(--border); color: var(--text-dim);
    padding: 9px 16px; border-radius: 8px; cursor: pointer; transition: all 0.15s ease;
  }
  .tab-btn:hover { color: var(--text); border-color: #34435F; }
  .tab-btn-active { color: var(--bg); background: var(--cyan); border-color: var(--cyan); font-weight: 700; }

  .app-main { max-width: 1080px; margin: 0 auto; }

  .panel {
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
    padding: 20px; margin-bottom: 16px;
  }
  .panel-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .panel-title-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
  .panel-subtitle { font-size: 12px; color: var(--text-dim); margin-bottom: 16px; line-height: 1.5; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 760px) { .grid-2 { grid-template-columns: 1fr; } }

  .field-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
  .field-label { font-size: 13px; color: var(--text-dim); display: flex; align-items: center; gap: 8px; flex: 1; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; margin-right: 6px; }
  .input-field {
    background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px;
    padding: 8px 10px; font-size: 13px; font-family: inherit; width: 100%;
  }
  .input-field:focus { outline: none; border-color: var(--cyan); }
  .input-with-unit { display: flex; align-items: center; gap: 6px; width: 130px; }
  .input-num { width: 90px; text-align: right; font-family: ui-monospace, monospace; }
  .input-inline { padding: 6px 8px; font-size: 13px; }
  .estado-select { width: auto; min-width: 110px; }
  .subject-select { width: auto; max-width: 220px; }
  .unit-tag { font-size: 11px; color: var(--text-dim); }
  .subject-inputs { margin: 14px 0; }
  .timer-box { margin: 14px 0; }
  .timer-display {
    font-size: 42px; font-weight: 800; text-align: center; letter-spacing: 0.03em;
    padding: 18px 0 6px; color: var(--cyan);
  }
  .day-total-row {
    display: flex; justify-content: space-between; font-size: 13px; color: var(--text-dim);
    border-top: 1px dashed var(--border); padding-top: 12px; margin-top: 6px;
  }
  .btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
  .btn-primary {
    background: var(--cyan); color: #06131C; border: none; border-radius: 8px; padding: 10px 18px;
    font-weight: 700; font-size: 13px; cursor: pointer;
  }
  .btn-primary:hover { filter: brightness(1.08); }
  .btn-ghost {
    background: transparent; border: 1px solid var(--border); color: var(--text-dim); border-radius: 8px;
    padding: 10px 16px; font-size: 13px; cursor: pointer;
  }
  .btn-ghost:hover { color: var(--red); border-color: rgba(255,92,92,0.4); }
  .btn-small { padding: 6px 10px; font-size: 12px; }

  .empty-hint { color: var(--text-dim); font-size: 13px; padding: 20px 0; text-align: center; }
  .log-list { display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; }
  .log-item {
    display: flex; align-items: center; gap: 10px; background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 12px; cursor: pointer; text-align: left; width: 100%;
  }
  .log-item:hover { border-color: var(--cyan); }
  .log-date { font-family: ui-monospace, monospace; font-size: 12px; color: var(--text-dim); width: 56px; flex-shrink: 0; }
  .log-detail { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
  .log-chip { font-size: 11px; border: 1px solid; border-radius: 20px; padding: 2px 8px; color: var(--text-dim); }
  .log-total { font-size: 12px; color: var(--text); flex-shrink: 0; }
  .history-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }

  .stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
  @media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
  .stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
  .stat-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px; }
  .stat-value { font-family: ui-monospace, monospace; font-size: 20px; font-weight: 700; }
  .stat-hint { font-size: 11px; color: var(--text-dim); margin-top: 4px; }

  .gauge-row { margin-bottom: 18px; }
  .gauge-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
  .gauge-label { font-size: 13px; color: var(--text); }
  .gauge-value { font-family: ui-monospace, monospace; font-size: 13px; color: var(--text); }
  .gauge-unit { font-size: 10px; color: var(--text-dim); margin-left: 2px; }
  .gauge-track { position: relative; height: 10px; background: var(--panel-2); border-radius: 6px; border: 1px solid var(--border); overflow: visible; }
  .gauge-fill { height: 100%; border-radius: 6px; transition: width 0.3s ease; }
  .gauge-ticks { position: absolute; inset: 0; }
  .gauge-tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.06); }
  .gauge-target { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); box-shadow: 0 0 4px rgba(255,255,255,0.6); }
  .gauge-sub { font-size: 11px; color: var(--text-dim); margin-top: 6px; }

  .table-wrap { overflow-x: auto; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .data-table th {
    text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim);
    padding: 8px 10px; border-bottom: 1px solid var(--border); font-weight: 600;
  }
  .data-table td { padding: 9px 10px; border-bottom: 1px solid rgba(38,50,74,0.5); }
  .data-table tr:last-child td { border-bottom: none; }
  .sortable-th { cursor: pointer; user-select: none; }
  .sortable-th:hover { color: var(--text); }
  .clickable-row { cursor: pointer; }
  .clickable-row:hover td { background: rgba(79,216,234,0.05); }

  .seg-control { display: flex; gap: 4px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 3px; }
  .seg-btn { background: transparent; border: none; color: var(--text-dim); font-size: 11px; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-family: ui-monospace, monospace; }
  .seg-btn-active { background: var(--cyan); color: #06131C; font-weight: 700; }

  .curso-list { display: flex; gap: 8px; flex-wrap: wrap; }
  .curso-chip { display: flex; align-items: center; border: 1px solid var(--border); border-radius: 20px; overflow: hidden; }
  .curso-chip button { background: var(--panel-2); color: var(--text-dim); border: none; padding: 8px 14px; font-size: 12px; cursor: pointer; font-family: ui-monospace, monospace; }
  .curso-chip-active button { background: var(--cyan); color: #06131C; font-weight: 700; }
  .curso-badge { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; margin-left: 6px; }
  .curso-remove { padding: 0 10px; color: var(--text-dim); cursor: pointer; font-size: 14px; }
  .curso-remove:hover { color: var(--red); }

  .badge-estado {
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; padding: 3px 9px; border-radius: 20px;
    border: 1px solid; white-space: nowrap;
  }
  .badge-estado-en_curso { color: var(--cyan); border-color: rgba(79,216,234,0.4); background: rgba(79,216,234,0.08); }
  .badge-estado-suspendida { color: var(--amber); border-color: rgba(245,166,35,0.4); background: rgba(245,166,35,0.08); }
  .badge-estado-aprobada { color: var(--green); border-color: rgba(61,220,132,0.4); background: rgba(61,220,132,0.08); }

  .wear-card { padding: 18px 20px 20px; }
  .wear-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .wear-card-head strong { font-size: 15px; }
  .wear-provisional { font-size: 10px; color: var(--text-dim); margin-left: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
  .wear-index-row { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
  .wear-index-value {
    font-family: ui-monospace, monospace; font-size: 46px; font-weight: 800; line-height: 1;
    min-width: 78px; text-align: right;
  }
  .wear-index-sub { font-size: 12px; color: var(--text-dim); margin-top: 6px; line-height: 1.5; max-width: 440px; }
  .wear-label { font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
  .wear-label-llevadero { color: var(--green); background: rgba(61,220,132,0.1); }
  .wear-label-moderado { color: var(--cyan); background: rgba(79,216,234,0.1); }
  .wear-label-duro { color: var(--amber); background: rgba(245,166,35,0.1); }
  .wear-label-extremo { color: var(--red); background: rgba(255,92,92,0.1); }
  .wear-factors { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  @media (max-width: 560px) { .wear-factors { grid-template-columns: 1fr; } }
  .wear-factor-card { background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
  .wear-factor-label { font-size: 12.5px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .wear-factor-raw { font-family: ui-monospace, monospace; font-size: 20px; font-weight: 700; color: var(--cyan); margin-bottom: 6px; }
  .wear-factor-explain { font-size: 11.5px; color: var(--text-dim); line-height: 1.45; }

  .merge-select { margin-top: 6px; font-size: 11.5px; color: var(--text-dim); padding: 5px 8px; }

  .modal-overlay {
    position: fixed; inset: 0; background: rgba(6,10,20,0.7); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100;
  }
  .modal-box {
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 440px;
    max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .modal-box-wide { max-width: 640px; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .modal-title { font-size: 15px; font-weight: 700; }
  .modal-close { background: transparent; border: none; color: var(--text-dim); font-size: 22px; line-height: 1; cursor: pointer; padding: 0 4px; }
  .modal-close:hover { color: var(--red); }
  .modal-body { padding: 18px 20px; }
`;
