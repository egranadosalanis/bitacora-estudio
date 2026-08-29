import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  PALETTE, uid, isoToday, addDays, formatShort, formatLong, formatMedium, hm,
  buildDefaultData, migrateData, computeStats, getSubjectEntries,
  computeDesgaste, priorComparableRawFactors, freezeApproval,
} from "./domain.js";

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

function BitacoraTab({ cursoSubjects, loggableSubjects, entries, onSaveDay, onDeleteDay }) {
  const [date, setDate] = useState(isoToday());
  const [values, setValues] = useState({});
  const [historySubjectId, setHistorySubjectId] = useState(loggableSubjects[0]?.id || cursoSubjects[0]?.id || null);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    const existing = entries[date] || {};
    const next = {};
    loggableSubjects.forEach((s) => { next[s.id] = existing[s.id] ? String(existing[s.id]) : ""; });
    setValues(next);
  }, [date, loggableSubjects, entries]);

  useEffect(() => {
    if (!historySubjectId && cursoSubjects[0]) setHistorySubjectId(cursoSubjects[0].id);
  }, [cursoSubjects, historySubjectId]);

  useEffect(() => { setVisibleCount(20); }, [historySubjectId]);

  const dayTotal = loggableSubjects.reduce((acc, s) => acc + (parseFloat(values[s.id]) || 0), 0);
  const hasEntryToday = !!entries[date] && loggableSubjects.some((s) => entries[date][s.id] > 0);

  const historySubject = cursoSubjects.find((s) => s.id === historySubjectId) || null;
  const history = historySubject ? getSubjectEntries(entries, historySubject.id, "desc") : [];

  return (
    <div className="grid-2">
      <div className="panel">
        <div className="panel-title">Registro de vuelo — {formatLong(date)}</div>
        <div className="field-row">
          <label className="field-label">Fecha</label>
          <input type="date" value={date} max={isoToday()} onChange={(e) => setDate(e.target.value)} className="input-field" />
        </div>
        {loggableSubjects.length === 0 ? (
          <div className="empty-hint">No hay asignaturas activas en este curso (todas están aprobadas o no has añadido ninguna todavía).</div>
        ) : (
          <>
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
          <div className="panel-title" style={{ marginBottom: 0 }}>Historial completo</div>
          {cursoSubjects.length > 0 && (
            <select className="input-field subject-select" value={historySubjectId || ""} onChange={(e) => setHistorySubjectId(e.target.value)}>
              {cursoSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
        {history.length === 0 && <div className="empty-hint">Todavía no hay registros para esta asignatura.</div>}
        {history.length > 0 && (
          <>
            <div className="log-list">
              {history.slice(0, visibleCount).map((e) => (
                <button key={e.date} className="log-item" onClick={() => setDate(e.date)}>
                  <span className="log-date">{formatShort(e.date)}</span>
                  <span className="log-detail">
                    <span className="log-chip" style={{ borderColor: historySubject?.color }}>{formatMedium(e.date)}</span>
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

/* ------------------------------------------------------------------ */
/*  TAB: TRAYECTORIA (graficos)                                        */
/* ------------------------------------------------------------------ */

function TrayectoriaTab({ cursoSubjects, entries, stats }) {
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
    cursoSubjects.forEach((s) => { row[s.name] = (entries[d] && entries[d][s.id]) || 0; });
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
            {cursoSubjects.map((s) => (
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

function ApprovalForm({ subject, onConfirm, onCancel }) {
  const [nota, setNota] = useState("");
  const [convocatorias, setConvocatorias] = useState("1");
  return (
    <div>
      <p className="panel-subtitle">
        Vas a marcar <strong>{subject.name}</strong> como aprobada. Esto congela para siempre sus métricas de
        clasificación histórica y su índice de desgaste con los datos de hoy — no se recalculan después.
      </p>
      <div className="field-row">
        <label className="field-label">Nota obtenida</label>
        <input type="number" step="0.1" className="input-field input-num" value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
      <div className="field-row">
        <label className="field-label">Convocatorias / cursos necesarios</label>
        <input type="number" min="1" step="1" className="input-field input-num" value={convocatorias} onChange={(e) => setConvocatorias(e.target.value)} />
      </div>
      <div className="btn-row">
        <button className="btn-primary" onClick={() => onConfirm({ nota, convocatorias })}>Confirmar aprobación</button>
        <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function AsignaturasTab({ subjects, cursoSubjects, unlinkedSubjects, curso, onAddSubject, onLinkSubject, onUnlinkSubject, onUpdateSubject, onChangeEstado, onApprove, cursos, activeCursoId, onSelectCurso, onAddCurso, onRemoveCurso }) {
  const [newSubject, setNewSubject] = useState({ name: "", credits: "" });
  const [newCurso, setNewCurso] = useState("");
  const [linkChoice, setLinkChoice] = useState("");
  const [approvingId, setApprovingId] = useState(null);

  function addSubject() {
    if (!newSubject.name.trim() || !newSubject.credits) return;
    onAddSubject(newSubject.name.trim(), parseFloat(newSubject.credits));
    setNewSubject({ name: "", credits: "" });
  }

  function addCurso() {
    if (!newCurso.trim()) return;
    onAddCurso(newCurso.trim());
    setNewCurso("");
  }

  const approvingSubject = approvingId ? subjects.find((s) => s.id === approvingId) : null;

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Cursos académicos</div>
        <div className="panel-subtitle">Cada curso agrupa las asignaturas que cursas ese año. Una asignatura suspendida puede retomarse en un curso posterior sin perder su historial.</div>
        <div className="curso-list">
          {cursos.map((c) => (
            <div key={c.id} className={`curso-chip ${c.id === activeCursoId ? "curso-chip-active" : ""}`}>
              <button onClick={() => onSelectCurso(c.id)}>{c.name}</button>
              {cursos.length > 1 && (
                <span className="curso-remove" onClick={() => onRemoveCurso(c.id)}>×</span>
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
                <th>Estado</th>
                <th>Créditos</th>
                <th>Referencia h/crédito</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cursoSubjects.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="dot" style={{ background: s.color }} />
                    <input
                      className="input-field input-inline"
                      value={s.name}
                      onChange={(e) => onUpdateSubject(s.id, { name: e.target.value })}
                    />
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
                  <td><button className="btn-ghost btn-small" onClick={() => onUnlinkSubject(s.id)}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <input className="input-field" placeholder="Nombre de la asignatura" value={newSubject.name} onChange={(e) => setNewSubject((v) => ({ ...v, name: e.target.value }))} />
          <input className="input-field input-num" type="number" min="1" placeholder="Créditos" value={newSubject.credits} onChange={(e) => setNewSubject((v) => ({ ...v, credits: e.target.value }))} />
          <button className="btn-primary" onClick={addSubject}>Añadir asignatura nueva</button>
        </div>
        {unlinkedSubjects.length > 0 && (
          <div className="btn-row" style={{ marginTop: 10 }}>
            <select className="input-field" value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)}>
              <option value="">Vincular asignatura ya existente (p. ej. una suspendida)…</option>
              {unlinkedSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {ESTADO_LABELS[s.estado]}</option>
              ))}
            </select>
            <button
              className="btn-primary"
              onClick={() => { if (linkChoice) { onLinkSubject(linkChoice); setLinkChoice(""); } }}
              disabled={!linkChoice}
              style={!linkChoice ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              Vincular a este curso
            </button>
          </div>
        )}
      </div>

      {approvingSubject && (
        <Modal title="Marcar asignatura como aprobada" onClose={() => setApprovingId(null)}>
          <ApprovalForm
            subject={approvingSubject}
            onCancel={() => setApprovingId(null)}
            onConfirm={({ nota, convocatorias }) => { onApprove(approvingSubject.id, { nota, convocatorias }); setApprovingId(null); }}
          />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: DESGASTE (peor tramo, normalizado y personal)                 */
/* ------------------------------------------------------------------ */

function DesgasteCard({ subject, desgaste }) {
  const isFrozen = subject.estado === "aprobada";
  const wb = desgaste.worstBlock;
  return (
    <div className="panel wear-card">
      <div className="wear-card-head">
        <div>
          <span className="dot" style={{ background: subject.color }} />
          <strong>{subject.name}</strong>
          {!isFrozen && <span className="wear-provisional">provisional</span>}
        </div>
        <EstadoBadge estado={subject.estado} />
      </div>
      {!desgaste.comparable && (
        <div className="empty-hint">No comparable — datos insuficientes (ningún bloque de ≥3 días activos).</div>
      )}
      {desgaste.comparable && !desgaste.hasTopes && (
        <div className="empty-hint">Bloque peor detectado, pero aún no hay ninguna asignatura aprobada con la que fijar una referencia.</div>
      )}
      {desgaste.comparable && desgaste.hasTopes && (
        <>
          <div className="wear-index-row">
            <span className="wear-index-value">{desgaste.indice.toFixed(2)}<span className="gauge-unit">/10</span></span>
            <span className={`wear-label wear-label-${desgaste.etiqueta.toLowerCase()}`}>{desgaste.etiqueta}</span>
          </div>
          <div className="wear-factors">
            <div className="wear-factor"><span>Intensidad</span><span className="mono">{desgaste.normalized.intensidad.toFixed(1)}/10 · {desgaste.rawFactors.intensidad.toFixed(0)} min/día</span></div>
            <div className="wear-factor"><span>Duración</span><span className="mono">{desgaste.normalized.duracion.toFixed(1)}/10 · {desgaste.rawFactors.duracion} días</span></div>
            <div className="wear-factor"><span>Compresión</span><span className="mono">{desgaste.normalized.compresion.toFixed(1)}/10 · {(desgaste.rawFactors.compresion * 100).toFixed(0)}%</span></div>
            <div className="wear-factor"><span>Racha interna</span><span className="mono">{desgaste.normalized.racha.toFixed(1)}/10 · {desgaste.rawFactors.racha} d</span></div>
          </div>
        </>
      )}
      {wb && <div className="gauge-sub">Peor tramo: {formatShort(wb.first)} → {formatShort(wb.last)}</div>}
    </div>
  );
}

function DesgasteTab({ subjects, entries }) {
  const rows = useMemo(() => {
    return subjects.map((s) => {
      if (s.estado === "aprobada") {
        return { subject: s, desgaste: s.frozen?.desgaste || { comparable: false } };
      }
      const prior = priorComparableRawFactors(subjects);
      const desgaste = computeDesgaste(s.id, entries, prior, { includeSelf: false });
      return { subject: s, desgaste };
    }).sort((a, b) => {
      const ai = a.desgaste.comparable && a.desgaste.hasTopes !== false ? (a.desgaste.indice ?? -1) : -2;
      const bi = b.desgaste.comparable && b.desgaste.hasTopes !== false ? (b.desgaste.indice ?? -1) : -2;
      if (a.subject.estado === "aprobada" && b.subject.estado !== "aprobada") return -1;
      if (b.subject.estado === "aprobada" && a.subject.estado !== "aprobada") return 1;
      return (bi ?? -2) - (ai ?? -2);
    });
  }, [subjects, entries]);

  if (rows.length === 0) return <div className="panel"><div className="empty-hint">Todavía no hay asignaturas.</div></div>;

  return (
    <div>
      <div className="panel-subtitle" style={{ margin: "0 0 16px", padding: "0 4px" }}>
        Mide el tramo de estudio más exigente de cada asignatura, comparado con tu propio historial. Para las
        asignaturas ya aprobadas el número queda congelado para siempre; para las que siguen en curso se muestra
        una vista previa que cambiará hasta que las apruebes.
      </div>
      {rows.map(({ subject, desgaste }) => (
        <DesgasteCard key={subject.id} subject={subject} desgaste={desgaste} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: CLASIFICACIÓN HISTÓRICA (tabla comparativa, sin normalizar)    */
/* ------------------------------------------------------------------ */

const CLASIF_COLUMNS = [
  { key: "name", label: "Asignatura" },
  { key: "horasPorCredito", label: "Horas/crédito" },
  { key: "diasTotales", label: "Días totales" },
  { key: "convocatorias", label: "Convocatorias" },
  { key: "nota", label: "Nota" },
];

function ClasificacionDetail({ subject }) {
  const f = subject.frozen;
  const d = f.desgaste;
  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <StatCard label="Horas / crédito" value={f.horasPorCredito.toFixed(2)} accent="#4FD8EA" />
        <StatCard label="Días totales" value={`${f.diasTotales} d`} accent="#F5A623" />
        <StatCard label="Convocatorias" value={f.convocatorias ?? "—"} accent="#A78BFA" />
        <StatCard label="Nota" value={f.nota ?? "—"} accent="#3DDC84" />
      </div>
      <div className="panel" style={{ marginTop: 4 }}>
        <div className="panel-title">Desgaste</div>
        {!d.comparable && <div className="empty-hint">No comparable — datos insuficientes.</div>}
        {d.comparable && d.hasTopes && (
          <>
            <div className="wear-index-row">
              <span className="wear-index-value">{d.indice.toFixed(2)}<span className="gauge-unit">/10</span></span>
              <span className={`wear-label wear-label-${d.etiqueta.toLowerCase()}`}>{d.etiqueta}</span>
            </div>
            <div className="wear-factors">
              <div className="wear-factor"><span>Intensidad</span><span className="mono">{d.normalized.intensidad.toFixed(1)}/10 · {d.rawFactors.intensidad.toFixed(0)} min/día</span></div>
              <div className="wear-factor"><span>Duración</span><span className="mono">{d.normalized.duracion.toFixed(1)}/10 · {d.rawFactors.duracion} días</span></div>
              <div className="wear-factor"><span>Compresión</span><span className="mono">{d.normalized.compresion.toFixed(1)}/10 · {(d.rawFactors.compresion * 100).toFixed(0)}%</span></div>
              <div className="wear-factor"><span>Racha interna</span><span className="mono">{d.normalized.racha.toFixed(1)}/10 · {d.rawFactors.racha} d</span></div>
            </div>
          </>
        )}
      </div>
      <div className="gauge-sub" style={{ padding: "0 4px" }}>
        Inicio: {f.fechaInicio ? formatMedium(f.fechaInicio) : "—"} · Aprobada: {formatMedium(f.fechaAprobacion)}
      </div>
    </div>
  );
}

function ClasificacionTab({ subjects }) {
  const [sortKey, setSortKey] = useState("horasPorCredito");
  const [sortDir, setSortDir] = useState("desc");
  const [detailId, setDetailId] = useState(null);

  const approved = subjects.filter((s) => s.estado === "aprobada" && s.frozen);

  const rows = useMemo(() => {
    const list = approved.map((s) => ({
      id: s.id, name: s.name, color: s.color,
      horasPorCredito: s.frozen.horasPorCredito,
      diasTotales: s.frozen.diasTotales,
      convocatorias: s.frozen.convocatorias ?? 0,
      nota: s.frozen.nota ?? 0,
    }));
    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [approved, sortKey, sortDir]);

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
                  <td className="mono">{r.diasTotales}</td>
                  <td className="mono">{r.convocatorias || "—"}</td>
                  <td className="mono">{r.nota || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailSubject && (
        <Modal title={detailSubject.name} onClose={() => setDetailId(null)} wide>
          <ClasificacionDetail subject={detailSubject} />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CONEXIÓN CON GOOGLE SHEETS (Apps Script)                           */
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

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("bitacora");
  const [cloudError, setCloudError] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const value = await cloudLoad();
        setData(migrateData(value ? JSON.parse(value) : buildDefaultData()));
        setCloudError(null);
      } catch (e) {
        setData(migrateData(buildDefaultData()));
        setCloudError(String((e && e.message) || e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    if (DISABLE_CLOUD_SAVE) return;
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
  const cursoSubjects = useMemo(
    () => (data && curso ? data.subjects.filter((s) => curso.subjectIds.includes(s.id)) : []),
    [data, curso]
  );
  const loggableSubjects = useMemo(() => cursoSubjects.filter((s) => s.estado !== "aprobada"), [cursoSubjects]);
  const unlinkedSubjects = useMemo(
    () => (data && curso ? data.subjects.filter((s) => !curso.subjectIds.includes(s.id) && s.estado !== "aprobada") : []),
    [data, curso]
  );
  const stats = useMemo(() => (data && cursoSubjects ? computeStats(cursoSubjects, data.entries) : null), [data, cursoSubjects]);

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
  }

  function handleAddSubject(name, credits) {
    setData((d) => {
      const newSub = { id: uid("sub"), name, credits, target: null, color: PALETTE[d.subjects.length % PALETTE.length], estado: "en_curso", frozen: null };
      return {
        ...d,
        subjects: [...d.subjects, newSub],
        cursos: d.cursos.map((c) => (c.id !== curso.id ? c : { ...c, subjectIds: [...c.subjectIds, newSub.id] })),
      };
    });
  }

  function handleLinkSubject(subjectId) {
    setData((d) => ({
      ...d,
      cursos: d.cursos.map((c) => (c.id !== curso.id || c.subjectIds.includes(subjectId) ? c : { ...c, subjectIds: [...c.subjectIds, subjectId] })),
    }));
  }

  function handleUnlinkSubject(subjectId) {
    setData((d) => {
      const cursos = d.cursos.map((c) => (c.id !== curso.id ? c : { ...c, subjectIds: c.subjectIds.filter((id) => id !== subjectId) }));
      const stillLinked = cursos.some((c) => c.subjectIds.includes(subjectId));
      const hasEntries = Object.values(d.entries).some((day) => day[subjectId] > 0);
      if (stillLinked || hasEntries) {
        return { ...d, cursos };
      }
      return { ...d, cursos, subjects: d.subjects.filter((s) => s.id !== subjectId) };
    });
  }

  function handleUpdateSubject(subjectId, patch) {
    setData((d) => ({ ...d, subjects: d.subjects.map((s) => (s.id === subjectId ? { ...s, ...patch } : s)) }));
  }

  function handleChangeEstado(subjectId, estado) {
    setData((d) => ({
      ...d,
      subjects: d.subjects.map((s) => (s.id === subjectId ? { ...s, estado, frozen: estado === "aprobada" ? s.frozen : null } : s)),
    }));
  }

  function handleApprove(subjectId, { nota, convocatorias }) {
    setData((d) => {
      const subject = d.subjects.find((s) => s.id === subjectId);
      const approved = freezeApproval(subject, { entries: d.entries, subjects: d.subjects, nota, convocatorias });
      return { ...d, subjects: d.subjects.map((s) => (s.id === subjectId ? approved : s)) };
    });
  }

  function handleAddCurso(name) {
    const id = uid("curso");
    setData((d) => ({ ...d, activeCursoId: id, cursos: [...d.cursos, { id, name, subjectIds: [] }] }));
  }

  function handleRemoveCurso(id) {
    setData((d) => {
      if (d.cursos.length === 1) return d;
      const cursos = d.cursos.filter((c) => c.id !== id);
      return { ...d, activeCursoId: d.activeCursoId === id ? cursos[0].id : d.activeCursoId, cursos };
    });
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
            entries={data.entries}
            onSaveDay={handleSaveDay}
            onDeleteDay={handleDeleteDay}
          />
        )}
        {tab === "panel" && <PanelTab stats={stats} />}
        {tab === "trayectoria" && <TrayectoriaTab cursoSubjects={cursoSubjects} entries={data.entries} stats={stats} />}
        {tab === "desgaste" && <DesgasteTab subjects={data.subjects} entries={data.entries} />}
        {tab === "clasificacion" && <ClasificacionTab subjects={data.subjects} />}
        {tab === "asignaturas" && (
          <AsignaturasTab
            subjects={data.subjects}
            cursoSubjects={cursoSubjects}
            unlinkedSubjects={unlinkedSubjects}
            curso={curso}
            cursos={data.cursos}
            activeCursoId={data.activeCursoId}
            onSelectCurso={(id) => setData((d) => ({ ...d, activeCursoId: id }))}
            onAddSubject={handleAddSubject}
            onLinkSubject={handleLinkSubject}
            onUnlinkSubject={handleUnlinkSubject}
            onUpdateSubject={handleUpdateSubject}
            onChangeEstado={handleChangeEstado}
            onApprove={handleApprove}
            onAddCurso={handleAddCurso}
            onRemoveCurso={handleRemoveCurso}
          />
        )}
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
  .curso-remove { padding: 0 10px; color: var(--text-dim); cursor: pointer; font-size: 14px; }
  .curso-remove:hover { color: var(--red); }

  .badge-estado {
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; padding: 3px 9px; border-radius: 20px;
    border: 1px solid; white-space: nowrap;
  }
  .badge-estado-en_curso { color: var(--cyan); border-color: rgba(79,216,234,0.4); background: rgba(79,216,234,0.08); }
  .badge-estado-suspendida { color: var(--amber); border-color: rgba(245,166,35,0.4); background: rgba(245,166,35,0.08); }
  .badge-estado-aprobada { color: var(--green); border-color: rgba(61,220,132,0.4); background: rgba(61,220,132,0.08); }

  .wear-card { padding: 16px 20px; }
  .wear-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .wear-provisional { font-size: 10px; color: var(--text-dim); margin-left: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
  .wear-index-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
  .wear-index-value { font-family: ui-monospace, monospace; font-size: 28px; font-weight: 700; }
  .wear-label { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
  .wear-label-llevadero { color: var(--green); background: rgba(61,220,132,0.1); }
  .wear-label-moderado { color: var(--cyan); background: rgba(79,216,234,0.1); }
  .wear-label-duro { color: var(--amber); background: rgba(245,166,35,0.1); }
  .wear-label-extremo { color: var(--red); background: rgba(255,92,92,0.1); }
  .wear-factors { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 20px; }
  @media (max-width: 560px) { .wear-factors { grid-template-columns: 1fr; } }
  .wear-factor { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--text-dim); }
  .wear-factor span:first-child { color: var(--text); }

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
