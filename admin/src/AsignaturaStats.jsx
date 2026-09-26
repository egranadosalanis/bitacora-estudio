import { useEffect, useState } from "react";
import { buscarNormalizacion, fetchAsignaturaEstadisticas } from "./api.js";
import { formatMinutes } from "./format.js";

const ESTADO_LABELS = { en_curso: "En curso", suspendida: "Suspendida", aprobada: "Aprobada", terminado: "Terminado" };

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

/** Buscador + selector de una canónica (universidad, carrera o asignatura),
 * encadenado por parentId — mismo patrón que el modo "fusionar con" de
 * NormalizationQueue.jsx, reutilizando la misma RPC de búsqueda del panel. */
function CascadingSelect({ tipo, parentId, disabled, disabledHint, placeholder, getLabel, value, onChange }) {
  const [busqueda, setBusqueda] = useState("");
  const [opciones, setOpciones] = useState([]);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    buscarNormalizacion(tipo, busqueda, parentId)
      .then((d) => { if (!cancelled) setOpciones(d.resultados); })
      .catch(() => { if (!cancelled) setOpciones([]); });
    return () => { cancelled = true; };
  }, [tipo, busqueda, parentId, disabled]);

  if (disabled) {
    return <input placeholder={disabledHint} disabled />;
  }

  return (
    <div className="pending-actions">
      <input placeholder={placeholder} value={busqueda} onChange={(e) => { setBusqueda(e.target.value); onChange(null); }} />
      <select value={value?.id || ""} onChange={(e) => onChange(opciones.find((o) => o.id === e.target.value) || null)}>
        <option value="">Elige…</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>{getLabel(o)}</option>
        ))}
      </select>
    </div>
  );
}

export default function AsignaturaStats() {
  const [universidad, setUniversidad] = useState(null);
  const [carrera, setCarrera] = useState(null);
  const [asignatura, setAsignatura] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!asignatura) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAsignaturaEstadisticas(asignatura.id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(err.message || String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [asignatura]);

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Busca por universidad, carrera y asignatura del catálogo canónico para ver, entre todos los estudiantes que
        la tienen vinculada, sus horas/crédito y la media del grupo.
      </p>

      <div className="search-row filter-row">
        <CascadingSelect
          tipo="universidad"
          placeholder="Buscar universidad…"
          getLabel={(o) => o.nombre}
          value={universidad}
          onChange={(row) => { setUniversidad(row); setCarrera(null); setAsignatura(null); }}
        />
        <CascadingSelect
          tipo="carrera"
          parentId={universidad?.id}
          disabled={!universidad}
          disabledHint="Elige primero la universidad"
          placeholder="Buscar carrera…"
          getLabel={(o) => o.nombre}
          value={carrera}
          onChange={(row) => { setCarrera(row); setAsignatura(null); }}
        />
        <CascadingSelect
          tipo="asignatura"
          parentId={carrera?.id}
          disabled={!carrera}
          disabledHint="Elige primero la carrera"
          placeholder="Buscar asignatura…"
          getLabel={(o) => `${o.nombre_oficial}${o.creditos != null ? ` (${o.creditos} cr.)` : ""}`}
          value={asignatura}
          onChange={setAsignatura}
        />
      </div>

      {loading && <div className="center-note">Cargando…</div>}
      {error && <div className="error-box">{error}</div>}

      {data && (
        <>
          <div className="panel-title">
            {data.asignatura.nombre}
            <div className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
              {data.asignatura.universidad} · {data.asignatura.carrera} · {data.asignatura.creditos} créditos
            </div>
          </div>

          <div className="kpi-row">
            <StatTile label="Estudiantes" value={data.resumen.estudiantes} />
            <StatTile label="Media h/crédito" value={data.resumen.mediaHorasPorCredito ?? "—"} />
            <StatTile label="Mínimo h/crédito" value={data.resumen.minHorasPorCredito ?? "—"} />
            <StatTile label="Máximo h/crédito" value={data.resumen.maxHorasPorCredito ?? "—"} />
          </div>

          {data.estudiantes.length === 0 && (
            <div className="center-note">Nadie tiene esta asignatura vinculada todavía.</div>
          )}
          {data.estudiantes.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Estado</th>
                    <th>Créditos</th>
                    <th>Horas totales</th>
                    <th>Horas/crédito</th>
                  </tr>
                </thead>
                <tbody>
                  {data.estudiantes.map((e, i) => (
                    <tr key={i}>
                      <td>{e.email || "—"}</td>
                      <td>{ESTADO_LABELS[e.estado] || e.estado}</td>
                      <td>{e.creditos}</td>
                      <td>{formatMinutes(e.minutosTotal)}</td>
                      <td>{e.horasPorCredito ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
