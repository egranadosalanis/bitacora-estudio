import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchUser } from "./api.js";
import { formatDate, formatMinutes, PLAN_LABELS } from "./format.js";

const ESTADO_LABELS = { en_curso: "En curso", suspendida: "Suspendida", aprobada: "Aprobada", terminado: "Terminado" };

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tt-label">{label}</div>
      <div>{formatter(payload[0].value)}</div>
    </div>
  );
}

function StudyTimeline({ registros }) {
  const data = registros.map((r) => ({ fecha: r.fecha, minutos: r.minutos }));
  if (data.length === 0) return <div className="muted" style={{ fontSize: 13 }}>Sin registros de estudio todavía.</div>;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis
          dataKey="fecha"
          tickFormatter={(d) => formatDate(d)}
          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          minTickGap={30}
        />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip content={<ChartTooltip formatter={(v) => formatMinutes(v)} />} labelFormatter={formatDate} cursor={{ stroke: "var(--baseline)" }} />
        <Area type="monotone" dataKey="minutos" stroke="var(--series-1)" strokeWidth={2} fill="var(--series-1)" fillOpacity={0.1} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function AsignaturasChart({ asignaturas }) {
  const top = asignaturas.slice(0, 8);
  if (top.length === 0) return <div className="muted" style={{ fontSize: 13 }}>Sin asignaturas todavía.</div>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, top.length * 30)}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--gridline)" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nombre" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} width={130} />
        <Tooltip content={<ChartTooltip formatter={(v) => formatMinutes(v)} />} cursor={{ fill: "var(--surface-2)" }} />
        <Bar dataKey="minutosTotal" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function UserDetail({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    fetchUser(userId).then(setData).catch((err) => setError(err.message));
  }, [userId]);

  const totalMinutos = useMemo(() => (data ? data.registros.reduce((s, r) => s + r.minutos, 0) : 0), [data]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="drawer-title">{data ? data.profile.email : "Cargando…"}</div>
            {data && (
              <div className="drawer-sub">
                {PLAN_LABELS[data.profile.plan] || data.profile.plan} · Alta {formatDate(data.profile.created_at)}
              </div>
            )}
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {error && <div className="error-box">{error}</div>}
        {!data && !error && <div className="center-note">Cargando…</div>}

        {data && (
          <>
            <div className="kpi-row">
              <div className="stat-tile">
                <div className="stat-label">Minutos totales</div>
                <div className="stat-value">{formatMinutes(totalMinutos)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Cursos</div>
                <div className="stat-value">{data.cursos.length}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Asignaturas</div>
                <div className="stat-value">{data.asignaturas.length}</div>
              </div>
            </div>

            <div className="drawer-sub" style={{ marginBottom: 6 }}>
              {data.profile.universidad || "Universidad no indicada"}
              {data.profile.carrera ? ` · ${data.profile.carrera}` : ""}
            </div>

            <div className="section-title">Minutos de estudio</div>
            <StudyTimeline registros={data.registros} />

            <div className="section-title">Asignaturas por minutos</div>
            <AsignaturasChart asignaturas={data.asignaturas} />

            <div className="section-title">Cursos</div>
            {data.cursos.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Sin cursos.</div>}
            {data.cursos.map((c) => (
              <div className="list-row" key={c.id}>
                <span className="list-row-name">{c.name}</span>
                <span className="list-row-value">
                  {ESTADO_LABELS[c.estado] || c.estado} · {formatDate(c.start_date)} – {formatDate(c.end_date)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
