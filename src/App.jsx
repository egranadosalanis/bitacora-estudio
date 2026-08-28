import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  DATOS Y CONSTANTES                                                 */
/* ------------------------------------------------------------------ */

const PALETTE = ["#4FD8EA", "#F5A623", "#3DDC84", "#A78BFA", "#FB923C", "#2DD4BF", "#FF8FB3", "#8DA3F0"];

const RAW_ENTRIES = {"2025-10-20":{"Motori per l'aeromobili":55},"2025-10-22":{"Motori per l'aeromobili":103},"2025-10-27":{"Motori per l'aeromobili":40},"2025-10-29":{"Motori per l'aeromobili":90},"2025-11-03":{"Motori per l'aeromobili":20},"2025-11-04":{"Motori per l'aeromobili":60},"2025-11-09":{"Spaceflight Mechanics":75},"2025-11-10":{"Spaceflight Mechanics":30},"2025-11-11":{"Spaceflight Mechanics":145},"2025-11-12":{"Spaceflight Mechanics":75},"2025-11-18":{"Spaceflight Mechanics":88},"2025-11-21":{"Spaceflight Mechanics":126},"2025-11-27":{"Calcolo Numerico":130},"2025-11-28":{"Calcolo Numerico":55},"2025-12-01":{"Calcolo Numerico":143,"Spaceflight Mechanics":125},"2025-12-02":{"Spaceflight Mechanics":25},"2025-12-03":{"Spaceflight Mechanics":215},"2025-12-04":{"Calcolo Numerico":110},"2025-12-05":{"Calcolo Numerico":163},"2025-12-06":{"Calcolo Numerico":60},"2025-12-07":{"Spaceflight Mechanics":225},"2025-12-08":{"Calcolo Numerico":30,"Spaceflight Mechanics":75},"2025-12-09":{"Calcolo Numerico":85},"2025-12-11":{"Calcolo Numerico":40},"2025-12-29":{"Calcolo Numerico":120},"2026-01-09":{"Spaceflight Mechanics":70},"2026-01-10":{"Calcolo Numerico":45,"Spaceflight Mechanics":120},"2026-01-11":{"Calcolo Numerico":120,"Spaceflight Mechanics":70},"2026-01-12":{"Spaceflight Mechanics":285},"2026-01-13":{"Calcolo Numerico":127,"Spaceflight Mechanics":80},"2026-01-14":{"Spaceflight Mechanics":50},"2026-01-15":{"Calcolo Numerico":125,"Spaceflight Mechanics":105},"2026-01-16":{"Spaceflight Mechanics":285},"2026-01-19":{"Calcolo Numerico":165},"2026-01-20":{"Calcolo Numerico":60,"Spaceflight Mechanics":80},"2026-01-21":{"Calcolo Numerico":70,"Spaceflight Mechanics":217},"2026-01-22":{"Calcolo Numerico":110},"2026-01-23":{"Calcolo Numerico":140,"Spaceflight Mechanics":175},"2026-01-24":{"Calcolo Numerico":60,"Spaceflight Mechanics":80},"2026-01-25":{"Spaceflight Mechanics":182},"2026-01-26":{"Calcolo Numerico":178},"2026-01-27":{"Calcolo Numerico":265},"2026-01-28":{"Calcolo Numerico":140},"2026-02-01":{"Motori per l'aeromobili":164},"2026-02-04":{"Motori per l'aeromobili":225},"2026-02-05":{"Motori per l'aeromobili":135},"2026-02-06":{"Motori per l'aeromobili":50},"2026-02-07":{"Motori per l'aeromobili":235},"2026-02-08":{"Motori per l'aeromobili":220},"2026-02-09":{"Motori per l'aeromobili":105},"2026-02-10":{"Motori per l'aeromobili":150},"2026-02-11":{"Motori per l'aeromobili":100},"2026-02-12":{"Motori per l'aeromobili":215},"2026-02-13":{"Motori per l'aeromobili":240},"2026-02-14":{"Motori per l'aeromobili":270},"2026-02-15":{"Motori per l'aeromobili":295},"2026-02-16":{"Motori per l'aeromobili":285},"2026-02-28":{"Meccanica del Volo":30},"2026-03-02":{"Meccanica del Volo":136},"2026-03-04":{"Meccanica del Volo":60},"2026-03-05":{"Meccanica del Volo":130},"2026-03-09":{"Meccanica del Volo":150},"2026-03-10":{"Meccanica del Volo":150},"2026-03-11":{"Meccanica del Volo":85},"2026-03-12":{"Meccanica del Volo":50},"2026-03-14":{"Meccanica del Volo":50},"2026-03-15":{"Meccanica del Volo":35},"2026-03-16":{"Meccanica del Volo":40},"2026-04-06":{"Meccanica del Volo":168},"2026-04-08":{"Meccanica del Volo":228},"2026-04-09":{"Meccanica del Volo":180},"2026-04-10":{"Meccanica del Volo":90},"2026-04-11":{"Meccanica del Volo":20},"2026-04-12":{"Meccanica del Volo":125},"2026-04-13":{"Meccanica del Volo":30},"2026-04-14":{"Meccanica del Volo":220},"2026-04-16":{"Meccanica del Volo":360},"2026-04-17":{"Meccanica del Volo":400},"2026-04-18":{"Meccanica del Volo":265},"2026-04-19":{"Meccanica del Volo":205},"2026-04-20":{"Meccanica del Volo":190},"2026-04-21":{"Meccanica del Volo":190},"2026-04-22":{"Meccanica del Volo":410},"2026-04-23":{"Meccanica del Volo":330},"2026-04-24":{"Meccanica del Volo":160},"2026-04-30":{"Spaceflight Mechanics":100},"2026-05-04":{"Spaceflight Mechanics":225,"Aerodinamica":40},"2026-05-05":{"Spaceflight Mechanics":50},"2026-05-06":{"Spaceflight Mechanics":145},"2026-05-07":{"Spaceflight Mechanics":39,"Motori per l'aeromobili":40},"2026-05-08":{"Aerospace Structures":200},"2026-05-15":{"Spaceflight Mechanics":110},"2026-05-16":{"Spaceflight Mechanics":155,"Motori per l'aeromobili":123},"2026-05-18":{"Spaceflight Mechanics":245},"2026-05-19":{"Spaceflight Mechanics":165},"2026-05-20":{"Spaceflight Mechanics":80,"Motori per l'aeromobili":150},"2026-05-21":{"Spaceflight Mechanics":130,"Motori per l'aeromobili":140},"2026-05-22":{"Spaceflight Mechanics":230},"2026-05-23":{"Spaceflight Mechanics":210},"2026-05-25":{"Spaceflight Mechanics":368},"2026-05-26":{"Spaceflight Mechanics":50,"Motori per l'aeromobili":270},"2026-05-27":{"Spaceflight Mechanics":215},"2026-05-30":{"Spaceflight Mechanics":200},"2026-05-31":{"Spaceflight Mechanics":170,"Motori per l'aeromobili":60},"2026-06-01":{"Spaceflight Mechanics":110,"Motori per l'aeromobili":135},"2026-06-02":{"Motori per l'aeromobili":314},"2026-06-03":{"Spaceflight Mechanics":263},"2026-06-04":{"Spaceflight Mechanics":235},"2026-06-05":{"Spaceflight Mechanics":40,"Motori per l'aeromobili":132},"2026-06-06":{"Spaceflight Mechanics":80,"Motori per l'aeromobili":382},"2026-06-07":{"Spaceflight Mechanics":130},"2026-06-08":{"Spaceflight Mechanics":60,"Motori per l'aeromobili":110},"2026-06-09":{"Aerospace Structures":170},"2026-06-11":{"Motori per l'aeromobili":118},"2026-06-12":{"Motori per l'aeromobili":295},"2026-06-13":{"Motori per l'aeromobili":344},"2026-06-14":{"Motori per l'aeromobili":442,"Aerodinamica":60},"2026-06-15":{"Motori per l'aeromobili":140},"2026-06-16":{"Motori per l'aeromobili":30},"2026-06-17":{"Aerodinamica":351},"2026-06-18":{"Aerodinamica":395},"2026-06-19":{"Aerodinamica":240}};

const DEFAULT_SUBJECT_DEFS = [
  { name: "Calcolo Numerico", credits: 6 },
  { name: "Meccanica del Volo", credits: 12 },
  { name: "Aerospace Structures", credits: 12 },
  { name: "Spaceflight Mechanics", credits: 12 },
  { name: "Motori per l'aeromobili", credits: 12 },
  { name: "Aerodinamica", credits: 12 },
];

function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function buildDefaultData() {
  const subjects = DEFAULT_SUBJECT_DEFS.map((s, i) => ({
    id: uid("sub"),
    name: s.name,
    credits: s.credits,
    target: null,
    color: PALETTE[i % PALETTE.length],
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
    activeCursoId: "curso_2025_2026",
    cursos: [
      {
        id: "curso_2025_2026",
        name: "2025-2026",
        subjects,
        entries,
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  UTILIDADES DE FECHA                                                */
/* ------------------------------------------------------------------ */

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function parseISO(iso) {
  return new Date(iso + "T00:00:00");
}
function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
function formatShort(iso) {
  const d = parseISO(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}
function formatLong(iso) {
  const d = parseISO(iso);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function hm(minutes) {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

/* ------------------------------------------------------------------ */
/*  CALCULOS DERIVADOS                                                 */
/* ------------------------------------------------------------------ */

function computeStats(curso) {
  const { subjects, entries } = curso;
  const dates = Object.keys(entries).sort();
  const dailyTotals = {};
  let maxSession = { minutes: 0, date: null, subjectId: null };

  dates.forEach((date) => {
    let dayTotal = 0;
    Object.entries(entries[date]).forEach(([subId, minutes]) => {
      dayTotal += minutes;
      if (minutes > maxSession.minutes) {
        maxSession = { minutes, date, subjectId: subId };
      }
    });
    dailyTotals[date] = dayTotal;
  });

  const activeDates = dates.filter((d) => dailyTotals[d] > 0).sort();
  const globalTotal = activeDates.reduce((acc, d) => acc + dailyTotals[d], 0);

  // racha mas larga
  let longest = 0, run = 0, prev = null;
  activeDates.forEach((d) => {
    if (prev && daysBetween(prev, d) === 1) run += 1;
    else run = 1;
    if (run > longest) longest = run;
    prev = d;
  });

  // racha actual (hasta hoy, con margen de "hoy aun no registrado")
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
      const m = entries[d][sub.id];
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
    dailyTotals, activeDates, globalTotal, longest, current,
    lastActiveDate, daysSinceLast, maxSession, perSubject,
    totalDaysLogged: activeDates.length,
  };
}

/* ------------------------------------------------------------------ */
/*  COMPONENTES DE UI                                                  */
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

/* ------------------------------------------------------------------ */
/*  TAB: BITACORA (registro diario)                                    */
/* ------------------------------------------------------------------ */

function BitacoraTab({ curso, onSaveDay, onDeleteDay, stats }) {
  const [date, setDate] = useState(isoToday());
  const [values, setValues] = useState({});

  useEffect(() => {
    const existing = curso.entries[date] || {};
    const next = {};
    curso.subjects.forEach((s) => { next[s.id] = existing[s.id] ? String(existing[s.id]) : ""; });
    setValues(next);
  }, [date, curso]);

  const dayTotal = curso.subjects.reduce((acc, s) => acc + (parseFloat(values[s.id]) || 0), 0);

  const recent = [...stats.activeDates].sort().reverse().slice(0, 8);

  return (
    <div className="grid-2">
      <div className="panel">
        <div className="panel-title">Registro de vuelo — {formatLong(date)}</div>
        <div className="field-row">
          <label className="field-label">Fecha</label>
          <input type="date" value={date} max={isoToday()} onChange={(e) => setDate(e.target.value)} className="input-field" />
        </div>
        <div className="subject-inputs">
          {curso.subjects.map((s) => (
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
        <div className="day-total-row">
          <span>Total del día</span>
          <span className="mono">{hm(dayTotal)}</span>
        </div>
        <div className="btn-row">
          <button
            className="btn-primary"
            onClick={() => {
              const clean = {};
              curso.subjects.forEach((s) => {
                const v = parseFloat(values[s.id]);
                if (v > 0) clean[s.id] = v;
              });
              onSaveDay(date, clean);
            }}
          >
            Guardar registro
          </button>
          {curso.entries[date] && (
            <button className="btn-ghost" onClick={() => onDeleteDay(date)}>Eliminar día</button>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Últimos registros</div>
        {recent.length === 0 && <div className="empty-hint">Todavía no hay vuelos registrados en este curso.</div>}
        <div className="log-list">
          {recent.map((d) => (
            <button key={d} className="log-item" onClick={() => setDate(d)}>
              <span className="log-date">{formatShort(d)}</span>
              <span className="log-detail">
                {Object.entries(curso.entries[d]).map(([subId, min]) => {
                  const s = curso.subjects.find((x) => x.id === subId);
                  return s ? (
                    <span key={subId} className="log-chip" style={{ borderColor: s.color }}>
                      {s.name.length > 14 ? s.name.slice(0, 14) + "…" : s.name} · {min}m
                    </span>
                  ) : null;
                })}
              </span>
              <span className="log-total mono">{hm(stats.dailyTotals[d])}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: PANEL (instrumentos)                                          */
/* ------------------------------------------------------------------ */

function PanelTab({ curso, stats, onSetTarget }) {
  const maxHoursPerCredit = Math.max(0.5, ...stats.perSubject.map((s) => s.hoursPerCredit), ...stats.perSubject.map((s) => s.target || 0)) * 1.15;
  const maxSessionSub = stats.maxSession.subjectId ? curso.subjects.find((s) => s.id === stats.maxSession.subjectId) : null;

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

/* ------------------------------------------------------------------ */
/*  TAB: TRAYECTORIA (graficos)                                        */
/* ------------------------------------------------------------------ */

function TrayectoriaTab({ curso, stats }) {
  const [range, setRange] = useState(90);

  const chartDates = useMemo(() => {
    const all = [...stats.activeDates].sort();
    if (all.length === 0) return [];
    if (range === 0) return all;
    const from = addDays(isoToday(), -range);
    return all.filter((d) => d >= from);
  }, [stats.activeDates, range]);

  const areaData = chartDates.map((d) => {
    const row = { date: formatShort(d) };
    curso.subjects.forEach((s) => { row[s.name] = curso.entries[d][s.id] || 0; });
    return row;
  });

  let acc = 0;
  const cumulativeData = [...stats.activeDates].sort().map((d) => {
    acc += stats.dailyTotals[d];
    return { date: formatShort(d), horas: +(acc / 60).toFixed(1) };
  });

  const pieData = stats.perSubject.filter((s) => s.total > 0).map((s) => ({ name: s.name, value: s.total, color: s.color }));

  const barData = stats.perSubject.map((s) => ({ name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name, horasPorCredito: +s.hoursPerCredit.toFixed(2), color: s.color }));

  return (
    <div>
      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title" style={{ marginBottom: 0 }}>Minutos diarios por asignatura</div>
          <div className="seg-control">
            {[30, 90, 0].map((r) => (
              <button key={r} className={`seg-btn ${range === r ? "seg-btn-active" : ""}`} onClick={() => setRange(r)}>
                {r === 0 ? "Todo el curso" : `${r} d`}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={areaData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26324A" />
            <XAxis dataKey="date" stroke="#8291AC" fontSize={11} minTickGap={30} />
            <YAxis stroke="#8291AC" fontSize={11} />
            <Tooltip contentStyle={{ background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#E7ECF5" }} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#8291AC" }} />
            {curso.subjects.map((s) => (
              <Area key={s.id} type="monotone" dataKey={s.name} stackId="1" stroke={s.color} fill={s.color} fillOpacity={0.55} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">Horas acumuladas en el curso</div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26324A" />
              <XAxis dataKey="date" stroke="#8291AC" fontSize={11} minTickGap={40} />
              <YAxis stroke="#8291AC" fontSize={11} />
              <Tooltip contentStyle={{ background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#E7ECF5" }} />
              <Line type="monotone" dataKey="horas" stroke="#4FD8EA" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">Distribución del esfuerzo</div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, fontSize: 12 }} formatter={(v) => hm(v)} />
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
            <Tooltip contentStyle={{ background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, fontSize: 12 }} />
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

function AsignaturasTab({ data, setData, curso }) {
  const [newSubject, setNewSubject] = useState({ name: "", credits: "" });
  const [newCurso, setNewCurso] = useState("");

  function updateSubject(subId, patch) {
    setData((d) => ({
      ...d,
      cursos: d.cursos.map((c) =>
        c.id !== curso.id ? c : { ...c, subjects: c.subjects.map((s) => (s.id === subId ? { ...s, ...patch } : s)) }
      ),
    }));
  }

  function removeSubject(subId) {
    setData((d) => ({
      ...d,
      cursos: d.cursos.map((c) => {
        if (c.id !== curso.id) return c;
        const entries = {};
        Object.entries(c.entries).forEach(([date, vals]) => {
          const { [subId]: _drop, ...rest } = vals;
          entries[date] = rest;
        });
        return { ...c, subjects: c.subjects.filter((s) => s.id !== subId), entries };
      }),
    }));
  }

  function addSubject() {
    if (!newSubject.name.trim() || !newSubject.credits) return;
    setData((d) => ({
      ...d,
      cursos: d.cursos.map((c) =>
        c.id !== curso.id
          ? c
          : {
              ...c,
              subjects: [
                ...c.subjects,
                {
                  id: uid("sub"),
                  name: newSubject.name.trim(),
                  credits: parseFloat(newSubject.credits),
                  target: null,
                  color: PALETTE[c.subjects.length % PALETTE.length],
                },
              ],
            }
      ),
    }));
    setNewSubject({ name: "", credits: "" });
  }

  function addCurso() {
    if (!newCurso.trim()) return;
    const id = uid("curso");
    setData((d) => ({
      activeCursoId: id,
      cursos: [...d.cursos, { id, name: newCurso.trim(), subjects: [], entries: {} }],
    }));
    setNewCurso("");
  }

  function removeCurso(id) {
    if (data.cursos.length === 1) return;
    setData((d) => {
      const cursos = d.cursos.filter((c) => c.id !== id);
      return { activeCursoId: d.activeCursoId === id ? cursos[0].id : d.activeCursoId, cursos };
    });
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Cursos académicos</div>
        <div className="panel-subtitle">Cada curso lleva su propio conjunto de asignaturas y registros, para poder comparar el esfuerzo de un año con otro.</div>
        <div className="curso-list">
          {data.cursos.map((c) => (
            <div key={c.id} className={`curso-chip ${c.id === data.activeCursoId ? "curso-chip-active" : ""}`}>
              <button onClick={() => setData((d) => ({ ...d, activeCursoId: c.id }))}>{c.name}</button>
              {data.cursos.length > 1 && (
                <span className="curso-remove" onClick={() => removeCurso(c.id)}>×</span>
              )}
            </div>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <input
            className="input-field"
            placeholder="Ej. 2026-2027"
            value={newCurso}
            onChange={(e) => setNewCurso(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCurso(); } }}
          />
          <button className="btn-primary" onClick={addCurso} disabled={!newCurso.trim()} style={!newCurso.trim() ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
            Añadir curso
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Asignaturas de {curso.name}</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asignatura</th>
                <th>Créditos</th>
                <th>Referencia h/crédito</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {curso.subjects.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="dot" style={{ background: s.color }} />
                    <input
                      className="input-field input-inline"
                      value={s.name}
                      onChange={(e) => updateSubject(s.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="1" step="1" className="input-field input-inline input-num"
                      value={s.credits}
                      onChange={(e) => updateSubject(s.id, { credits: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0" step="0.1" className="input-field input-inline input-num"
                      placeholder="opcional"
                      value={s.target ?? ""}
                      onChange={(e) => updateSubject(s.id, { target: e.target.value === "" ? null : parseFloat(e.target.value) })}
                    />
                  </td>
                  <td><button className="btn-ghost btn-small" onClick={() => removeSubject(s.id)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <input className="input-field" placeholder="Nombre de la asignatura" value={newSubject.name} onChange={(e) => setNewSubject((v) => ({ ...v, name: e.target.value }))} />
          <input className="input-field input-num" type="number" min="1" placeholder="Créditos" value={newSubject.credits} onChange={(e) => setNewSubject((v) => ({ ...v, credits: e.target.value }))} />
          <button className="btn-primary" onClick={addSubject}>Añadir asignatura</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CONEXIÓN CON GOOGLE SHEETS (Apps Script)                           */
/* ------------------------------------------------------------------ */

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
const APPS_SCRIPT_TOKEN = import.meta.env.VITE_APPS_SCRIPT_TOKEN;

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

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("bitacora");
  const [cloudError, setCloudError] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const value = await cloudLoad();
        setData(value ? JSON.parse(value) : buildDefaultData());
        setCloudError(null);
      } catch (e) {
        setData(buildDefaultData());
        setCloudError(String((e && e.message) || e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await cloudSave(data);
        setCloudError(null);
      } catch (e) {
        setCloudError(String((e && e.message) || e));
      }
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  const curso = useMemo(() => data && data.cursos.find((c) => c.id === data.activeCursoId), [data]);
  const stats = useMemo(() => (curso ? computeStats(curso) : null), [curso]);

  function handleSaveDay(date, values) {
    setData((d) => ({
      ...d,
      cursos: d.cursos.map((c) => {
        if (c.id !== curso.id) return c;
        const entries = { ...c.entries };
        if (Object.keys(values).length === 0) delete entries[date];
        else entries[date] = values;
        return { ...c, entries };
      }),
    }));
  }

  function handleDeleteDay(date) {
    setData((d) => ({
      ...d,
      cursos: d.cursos.map((c) => {
        if (c.id !== curso.id) return c;
        const { [date]: _drop, ...rest } = c.entries;
        return { ...c, entries: rest };
      }),
    }));
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
        </div>
      </header>

      <nav className="tab-bar">
        <Tab id="bitacora" active={tab === "bitacora"} onClick={setTab}>Bitácora</Tab>
        <Tab id="panel" active={tab === "panel"} onClick={setTab}>Panel</Tab>
        <Tab id="trayectoria" active={tab === "trayectoria"} onClick={setTab}>Trayectoria</Tab>
        <Tab id="asignaturas" active={tab === "asignaturas"} onClick={setTab}>Asignaturas</Tab>
      </nav>

      <main className="app-main">
        {tab === "bitacora" && <BitacoraTab curso={curso} stats={stats} onSaveDay={handleSaveDay} onDeleteDay={handleDeleteDay} />}
        {tab === "panel" && <PanelTab curso={curso} stats={stats} />}
        {tab === "trayectoria" && <TrayectoriaTab curso={curso} stats={stats} />}
        {tab === "asignaturas" && <AsignaturasTab data={data} setData={setData} curso={curso} />}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ESTILOS                                                             */
/* ------------------------------------------------------------------ */

const CSS = `
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
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .input-field {
    background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px;
    padding: 8px 10px; font-size: 13px; font-family: inherit; width: 100%;
  }
  .input-field:focus { outline: none; border-color: var(--cyan); }
  .input-with-unit { display: flex; align-items: center; gap: 6px; width: 130px; }
  .input-num { width: 90px; text-align: right; font-family: ui-monospace, monospace; }
  .input-inline { padding: 6px 8px; font-size: 13px; }
  .unit-tag { font-size: 11px; color: var(--text-dim); }
  .subject-inputs { margin: 14px 0; }
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

  .seg-control { display: flex; gap: 4px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 3px; }
  .seg-btn { background: transparent; border: none; color: var(--text-dim); font-size: 11px; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-family: ui-monospace, monospace; }
  .seg-btn-active { background: var(--cyan); color: #06131C; font-weight: 700; }

  .curso-list { display: flex; gap: 8px; flex-wrap: wrap; }
  .curso-chip { display: flex; align-items: center; border: 1px solid var(--border); border-radius: 20px; overflow: hidden; }
  .curso-chip button { background: var(--panel-2); color: var(--text-dim); border: none; padding: 8px 14px; font-size: 12px; cursor: pointer; font-family: ui-monospace, monospace; }
  .curso-chip-active button { background: var(--cyan); color: #06131C; font-weight: 700; }
  .curso-remove { padding: 0 10px; color: var(--text-dim); cursor: pointer; font-size: 14px; }
  .curso-remove:hover { color: var(--red); }
`;
