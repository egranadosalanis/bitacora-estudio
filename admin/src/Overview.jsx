import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { fetchOverview } from "./api.js";
import { formatCompact, formatMinutes, formatWeekLabel, PLAN_LABELS } from "./format.js";

const PLAN_ORDER = ["free", "premium_historico", "premium_comparacion"];
const PLAN_COLORS = { free: "var(--series-1)", premium_historico: "var(--series-2)", premium_comparacion: "var(--series-3)" };

function StatTile({ label, value, hint }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tt-label">{label}</div>
      <div>{formatter(payload[0].value)}</div>
    </div>
  );
}

function SignupsChart({ data }) {
  return (
    <div className="panel">
      <div className="panel-title">Altas por semana (últimas 12 semanas)</div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="week"
            tickFormatter={formatWeekLabel}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--baseline)" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => `${v} altas`} />}
            labelFormatter={formatWeekLabel}
            cursor={{ stroke: "var(--baseline)" }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill="var(--series-1)"
            fillOpacity={0.1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MinutesChart({ data }) {
  return (
    <div className="panel">
      <div className="panel-title">Minutos estudiados por semana (todos los usuarios)</div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="week"
            tickFormatter={formatWeekLabel}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--baseline)" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            content={<ChartTooltip formatter={(v) => formatMinutes(v)} />}
            labelFormatter={formatWeekLabel}
            cursor={{ stroke: "var(--baseline)" }}
          />
          <Area
            type="monotone"
            dataKey="minutes"
            stroke="var(--series-2)"
            strokeWidth={2}
            fill="var(--series-2)"
            fillOpacity={0.1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlanDistribution({ planCounts, totalUsers }) {
  const plans = PLAN_ORDER.filter((p) => planCounts[p]);
  return (
    <div className="panel">
      <div className="panel-title">Distribución de planes</div>
      <div className="segbar">
        {plans.map((p, i) => (
          <div
            key={p}
            className="segbar-seg"
            style={{
              width: `${(planCounts[p] / totalUsers) * 100}%`,
              background: PLAN_COLORS[p],
              marginRight: i < plans.length - 1 ? 2 : 0,
            }}
            title={`${PLAN_LABELS[p] || p}: ${planCounts[p]}`}
          />
        ))}
      </div>
      <div className="segbar-legend">
        {plans.map((p) => (
          <div className="legend-item" key={p}>
            <span className="legend-swatch" style={{ background: PLAN_COLORS[p] }} />
            {PLAN_LABELS[p] || p} · {planCounts[p]}
          </div>
        ))}
      </div>
    </div>
  );
}

function TopList({ title, items }) {
  return (
    <div className="panel">
      <div className="panel-title">{title}</div>
      {items.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>Sin datos todavía.</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(140, items.length * 32)}>
          <BarChart data={items} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={140}
            />
            <Tooltip content={<ChartTooltip formatter={(v) => `${v} usuarios`} />} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="count" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: "right", fill: "var(--text-secondary)", fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOverview().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <div className="center-note">Cargando…</div>;

  return (
    <>
      <div className="kpi-row">
        <StatTile label="Usuarios totales" value={data.totalUsers} />
        <StatTile label="Activos (7 días)" value={data.activeUsers7d} />
        <StatTile label="Activos (30 días)" value={data.activeUsers30d} />
        <StatTile label="Minutos estudiados (total)" value={formatCompact(data.totalMinutes)} hint={formatMinutes(data.totalMinutes)} />
        <StatTile label="Asignaturas creadas" value={data.totalAsignaturas} />
        <StatTile label="Cursos creados" value={data.totalCursos} />
      </div>

      <div className="panel-grid">
        <SignupsChart data={data.signupsByWeek} />
        <MinutesChart data={data.minutesByWeek} />
      </div>

      <div className="panel-grid">
        <PlanDistribution planCounts={data.planCounts} totalUsers={data.totalUsers} />
        <TopList title="Universidades con más usuarios" items={data.topUniversidades} />
      </div>

      <TopList title="Carreras con más usuarios" items={data.topCarreras} />
    </>
  );
}
