import { useEffect, useMemo, useState } from "react";
import { fetchNormalizacionPendientes, buscarNormalizacion, postNormalizacionAccion } from "./api.js";
import { formatDate } from "./format.js";

const TIPOS = [
  { value: "", label: "Todos" },
  { value: "universidad", label: "Universidades" },
  { value: "carrera", label: "Carreras" },
  { value: "asignatura", label: "Asignaturas" },
];

const ORIGEN_LABELS = { alta_libre: "Alta libre", migracion: "Migración", seed: "Siembra" };

/** Fila con las acciones de la cola: aprobar tal cual, renombrar y
 * aprobar, fusionar con una canónica existente, o rechazar. Cada
 * acción refresca la lista al terminar. */
function PendingRow({ tipo, row, nombre, parentLabel, onDone }) {
  const [mode, setMode] = useState(null); // null | 'renombrar' | 'fusionar'
  const [nombreNuevo, setNombreNuevo] = useState(nombre);
  const [busqueda, setBusqueda] = useState("");
  const [opciones, setOpciones] = useState([]);
  const [destino, setDestino] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const parentIdParaBusqueda = tipo === "carrera" ? row.universidad_id : tipo === "asignatura" ? row.carrera_id : null;

  useEffect(() => {
    if (mode !== "fusionar") return;
    let cancelled = false;
    buscarNormalizacion(tipo, busqueda, parentIdParaBusqueda)
      .then((d) => { if (!cancelled) setOpciones(d.resultados.filter((o) => o.id !== row.id)); })
      .catch(() => { if (!cancelled) setOpciones([]); });
    return () => { cancelled = true; };
  }, [mode, busqueda, tipo, parentIdParaBusqueda, row.id]);

  async function run(accion, extra) {
    setBusy(true);
    setError(null);
    try {
      await postNormalizacionAccion({ accion, tipo, id: row.id, ...extra });
      onDone();
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        {nombre}
        {parentLabel && <div className="muted">{parentLabel}</div>}
      </td>
      <td>{row.usos}</td>
      <td>{ORIGEN_LABELS[row.origen] || row.origen}</td>
      <td>{formatDate(row.created_at)}</td>
      <td>
        {mode === null && (
          <div className="pending-actions">
            <button className="btn" disabled={busy} onClick={() => run("aprobar")}>Aprobar</button>
            <button className="btn" disabled={busy} onClick={() => setMode("renombrar")}>Renombrar y aprobar</button>
            <button className="btn" disabled={busy} onClick={() => setMode("fusionar")}>Fusionar con…</button>
            <button className="btn" disabled={busy} onClick={() => run("rechazar")}>Rechazar</button>
          </div>
        )}
        {mode === "renombrar" && (
          <div className="pending-actions">
            <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} />
            <button className="btn btn-primary" disabled={busy || !nombreNuevo.trim()} onClick={() => run("renombrar_aprobar", { nombreNuevo })}>
              Confirmar
            </button>
            <button className="btn" disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
          </div>
        )}
        {mode === "fusionar" && (
          <div className="pending-actions">
            <input placeholder="Buscar canónica…" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setDestino(null); }} />
            {opciones.length > 0 && (
              <select value={destino || ""} onChange={(e) => setDestino(e.target.value)}>
                <option value="">Elige…</option>
                {opciones.map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre || o.nombre_oficial}</option>
                ))}
              </select>
            )}
            <button className="btn btn-primary" disabled={busy || !destino} onClick={() => run("fusionar", { destinoId: destino })}>
              Confirmar
            </button>
            <button className="btn" disabled={busy} onClick={() => setMode(null)}>Cancelar</button>
          </div>
        )}
        {error && <div className="error-box" style={{ marginTop: 6, marginBottom: 0 }}>{error}</div>}
      </td>
    </tr>
  );
}

function PendingTable({ title, rows, tipo, getNombre, getParentLabel, onDone }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="panel-title">{title} ({rows.length})</div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Texto</th>
              <th>Usuarios</th>
              <th>Origen</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PendingRow
                key={row.id}
                tipo={tipo}
                row={row}
                nombre={getNombre(row)}
                parentLabel={getParentLabel(row)}
                onDone={onDone}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function NormalizationQueue() {
  const [tipo, setTipo] = useState("");
  const [minAgeDays, setMinAgeDays] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const filters = useMemo(() => {
    const f = {};
    if (tipo) f.tipo = tipo;
    if (minAgeDays) f.minAgeDays = minAgeDays;
    return f;
  }, [tipo, minAgeDays]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetchNormalizacionPendientes(filters)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [filters, reloadTick]);

  const reload = () => setReloadTick((t) => t + 1);

  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <div className="center-note">Cargando…</div>;

  const total = (data.universidades?.length || 0) + (data.carreras?.length || 0) + (data.asignaturas?.length || 0);

  return (
    <>
      <div className="search-row filter-row">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="number" min="0" placeholder="Antigüedad mínima (días)"
          value={minAgeDays} onChange={(e) => setMinAgeDays(e.target.value)}
        />
      </div>

      {total === 0 && <div className="center-note">No hay nada pendiente de revisar.</div>}

      <PendingTable
        title="Universidades"
        rows={data.universidades}
        tipo="universidad"
        getNombre={(r) => r.nombre}
        getParentLabel={(r) => r.pais}
        onDone={reload}
      />
      <PendingTable
        title="Carreras"
        rows={data.carreras}
        tipo="carrera"
        getNombre={(r) => r.nombre}
        getParentLabel={(r) => r.universidadNombre}
        onDone={reload}
      />
      <PendingTable
        title="Asignaturas"
        rows={data.asignaturas}
        tipo="asignatura"
        getNombre={(r) => r.nombre_oficial}
        getParentLabel={(r) => r.carreraNombre}
        onDone={reload}
      />
    </>
  );
}
