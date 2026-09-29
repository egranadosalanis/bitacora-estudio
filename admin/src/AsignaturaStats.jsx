import { useEffect, useMemo, useState } from "react";
import {
  fetchCarrerasCatalogo, fetchAsignaturasDeCarrera, fetchFichaAsignatura, postMarcaAsignatura,
} from "./api.js";
import { formatDate } from "./format.js";
import UserDetail from "./UserDetail.jsx";

const CARRERA_KEY = "bitacora_admin_ultima_carrera";
const num = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d));

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function Etiquetas({ a }) {
  return (
    <>
      {a.isErasmus && <span className="badge-plan">Erasmus</span>}{" "}
      {a.noCredits && <span className="badge-plan">Sin créditos</span>}{" "}
      {a.excluida && <span className="badge-plan">Excluida de estadísticas</span>}
    </>
  );
}

function useOrden(inicialKey, inicialDir = "desc") {
  const [key, setKey] = useState(inicialKey);
  const [dir, setDir] = useState(inicialDir);
  const toggle = (k) => {
    if (k === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setKey(k); setDir("desc"); }
  };
  const ordenar = (rows) => {
    const m = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // los vacíos siempre al final
      if (bv == null) return -1;
      if (typeof av === "string") return av.localeCompare(bv) * m;
      return (av - bv) * m;
    });
  };
  return { key, dir, toggle, ordenar };
}

function Cabecera({ columnas, orden }) {
  return (
    <tr>
      {columnas.map((c) => (
        <th
          key={c.key}
          onClick={() => orden.toggle(c.key)}
          className={orden.key === c.key ? "active-sort" : ""}
          style={{ textAlign: c.align || "right" }}
        >
          {c.label}{orden.key === c.key ? (orden.dir === "asc" ? " ▲" : " ▼") : ""}
        </th>
      ))}
    </tr>
  );
}

const COLUMNAS_TABLA = [
  { key: "nombre", label: "Nombre canónico", align: "left" },
  { key: "creditos", label: "Créditos" },
  { key: "usuarios", label: "Usuarios" },
  { key: "horasTotales", label: "Horas totales" },
  { key: "horasMediasPorUsuario", label: "Horas medias/usuario" },
  { key: "mediaHorasPorCredito", label: "h/crédito medias" },
  { key: "medianaHorasPorCredito", label: "h/crédito mediana" },
  { key: "alias", label: "Alias" },
  { key: "ultimaActividad", label: "Última actividad" },
  { key: "estado", label: "Estado", align: "left" },
];

const COLUMNAS_USUARIOS = [
  { key: "email", label: "Usuario", align: "left" },
  { key: "minutos", label: "Horas" },
  { key: "horasPorCredito", label: "h/crédito" },
  { key: "sesiones", label: "Sesiones" },
  { key: "ultima", label: "Último registro" },
];

/** Casilla de una marca: pide confirmación con el efecto y guarda al confirmar. */
function Marca({ etiqueta, efecto, aviso, checked, onChange, disabled }) {
  function cambiar(e) {
    const nuevo = e.target.checked;
    if (window.confirm(`${aviso}\n\n¿Confirmas ${nuevo ? "marcarla" : "desmarcarla"}?`)) onChange(nuevo);
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <label><input type="checkbox" checked={checked} disabled={disabled} onChange={cambiar} /> {etiqueta}</label>
      <div className="muted" style={{ fontSize: 13 }}>{efecto}</div>
    </div>
  );
}

function Ficha({ id, onBack, onOpenUser, orden }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFichaAsignatura(id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  async function cambiarMarca(campo, valor) {
    setGuardando(true);
    setError(null);
    try {
      await postMarcaAsignatura(id, campo, valor);
      setData(await fetchFichaAsignatura(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (error && !data) return <><button className="btn back-btn" onClick={onBack}>← Volver al listado</button><div className="error-box">{error}</div></>;
  if (!data) return <div className="center-note">Cargando…</div>;
  const { asignatura: a, resumen: r } = data;
  const usuarios = orden.ordenar(data.usuarios);

  return (
    <>
      <button className="btn back-btn" onClick={onBack}>← Volver al listado</button>
      <div className="panel-title">
        {a.nombre}
        <div className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
          {a.universidad} · {a.carrera} · {a.creditos != null ? `${a.creditos} créditos` : "sin créditos indicados"}
        </div>
        <div><Etiquetas a={a} /></div>
      </div>
      {error && <div className="error-box">{error}</div>}

      <Marca
        etiqueta="Es Erasmus"
        efecto="Sigue contando en Rangos, Clasificación, Desgaste y estadísticas personales, pero queda fuera de Social y de las medias del grupo."
        aviso="Esta asignatura dejará de contar en estadísticas de carrera canónica (Social, medias del grupo), pero seguirá contando en todo lo demás: Rangos, Clasificación, Desgaste y estadísticas personales."
        checked={a.isErasmus} disabled={guardando}
        onChange={(v) => cambiarMarca("is_erasmus", v)}
      />
      <Marca
        etiqueta="No tiene créditos"
        efecto="Sus horas siguen contando como esfuerzo, pero no entra en ningún cálculo con créditos (Rangos, Clasificación, medias del grupo)."
        aviso="Esta asignatura dejará de contar en Rangos, Clasificación y medias del grupo."
        checked={a.noCredits} disabled={guardando}
        onChange={(v) => cambiarMarca("no_credits", v)}
      />

      <div className="kpi-row">
        <StatTile label="Usuarios" value={r.usuarios} />
        <StatTile label="Horas totales" value={num(r.horasTotales, 1)} />
        <StatTile label="Media h/crédito" value={num(r.mediaHorasPorCredito)} />
        <StatTile label="Mediana h/crédito" value={num(r.medianaHorasPorCredito)} />
        <StatTile label="Mínimo h/crédito" value={num(r.minHorasPorCredito)} />
        <StatTile label="Máximo h/crédito" value={num(r.maxHorasPorCredito)} />
      </div>

      <div className="panel-title">Alias vinculados</div>
      <p className="muted">{data.alias.length ? data.alias.join(" · ") : "Ninguno."}</p>

      <div className="panel-title">Usuarios con esta asignatura</div>
      {usuarios.length === 0 ? (
        <div className="center-note">Nadie la tiene vinculada todavía.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><Cabecera columnas={COLUMNAS_USUARIOS} orden={orden} /></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={`${u.userId}-${u.creditos}-${u.minutos}`} className="row-clickable" onClick={() => onOpenUser(u.userId)}>
                  <td>{u.email || "—"}</td>
                  <td style={{ textAlign: "right" }}>{num(u.minutos / 60, 1)}</td>
                  <td style={{ textAlign: "right" }}>{a.excluida ? "—" : num(u.horasPorCredito)}</td>
                  <td style={{ textAlign: "right" }}>{u.sesiones}</td>
                  <td style={{ textAlign: "right" }}>{formatDate(u.ultima)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AsignaturaStats() {
  const [carreras, setCarreras] = useState(null);
  const [carreraId, setCarreraId] = useState(() => {
    try { return window.localStorage.getItem(CARRERA_KEY) || ""; } catch { return ""; }
  });
  const [buscaCarrera, setBuscaCarrera] = useState("");
  const [asignaturas, setAsignaturas] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [soloExcluidas, setSoloExcluidas] = useState(false);
  const [soloRevisar, setSoloRevisar] = useState(false);
  const [fichaId, setFichaId] = useState(null);
  const [usuarioId, setUsuarioId] = useState(null);
  const ordenTabla = useOrden("usuarios");
  const ordenUsuarios = useOrden("minutos");

  useEffect(() => {
    fetchCarrerasCatalogo().then((d) => setCarreras(d.carreras)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!carreraId) { setAsignaturas(null); return; }
    let cancelled = false;
    setAsignaturas(null);
    fetchAsignaturasDeCarrera(carreraId)
      .then((d) => { if (!cancelled) setAsignaturas(d.asignaturas); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [carreraId]);

  function elegirCarrera(id) {
    setCarreraId(id);
    setError(null);
    try { window.localStorage.setItem(CARRERA_KEY, id); } catch { /* sin almacenamiento: no se recuerda */ }
  }

  const carrerasFiltradas = useMemo(() => {
    const q = buscaCarrera.trim().toLowerCase();
    return (carreras || []).filter((c) => !q || `${c.nombre} ${c.universidad || ""}`.toLowerCase().includes(q));
  }, [carreras, buscaCarrera]);

  const filas = useMemo(() => {
    if (!asignaturas) return [];
    const q = query.trim().toLowerCase();
    let rows = asignaturas.map((a) => ({ ...a, estado: [a.isErasmus && "Erasmus", a.noCredits && "Sin créditos"].filter(Boolean).join(", ") }));
    if (q) rows = rows.filter((a) => a.nombre.toLowerCase().includes(q));
    if (soloExcluidas) rows = rows.filter((a) => a.excluida);
    if (soloRevisar) rows = rows.filter((a) => (a.creditos == null || Number(a.creditos) === 0) && !a.noCredits);
    return ordenTabla.ordenar(rows);
  }, [asignaturas, query, soloExcluidas, soloRevisar, ordenTabla]);

  if (usuarioId) {
    return <UserDetail userId={usuarioId} onBack={() => setUsuarioId(null)} backLabel="Volver a la asignatura" />;
  }
  if (fichaId) {
    return <Ficha id={fichaId} orden={ordenUsuarios} onBack={() => { setFichaId(null); }} onOpenUser={setUsuarioId} />;
  }

  return (
    <>
      <div className="search-row filter-row">
        <input placeholder="Buscar carrera o universidad…" value={buscaCarrera} onChange={(e) => setBuscaCarrera(e.target.value)} />
        <select value={carreraId} onChange={(e) => elegirCarrera(e.target.value)}>
          <option value="">Elige una carrera…</option>
          {carrerasFiltradas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre} · {c.universidad || "—"}</option>
          ))}
        </select>
      </div>

      {error && <div className="error-box">{error}</div>}
      {!carreraId && <div className="center-note">Elige una carrera para ver sus asignaturas</div>}
      {carreraId && !asignaturas && !error && <div className="center-note">Cargando…</div>}

      {asignaturas && (
        <>
          <div className="search-row filter-row">
            <input placeholder="Buscar asignatura por nombre…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <label><input type="checkbox" checked={soloExcluidas} onChange={(e) => setSoloExcluidas(e.target.checked)} /> Mostrar solo excluidas</label>
            <label><input type="checkbox" checked={soloRevisar} onChange={(e) => setSoloRevisar(e.target.checked)} /> Revisar: créditos vacíos o 0 sin marcar</label>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><Cabecera columnas={COLUMNAS_TABLA} orden={ordenTabla} /></thead>
              <tbody>
                {filas.map((a) => (
                  <tr key={a.id} className="row-clickable" onClick={() => setFichaId(a.id)}>
                    <td>{a.nombre}</td>
                    <td style={{ textAlign: "right" }}>{a.creditos ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{a.usuarios}</td>
                    <td style={{ textAlign: "right" }}>{num(a.horasTotales, 1)}</td>
                    <td style={{ textAlign: "right" }}>{num(a.horasMediasPorUsuario, 1)}</td>
                    <td style={{ textAlign: "right" }}>{num(a.mediaHorasPorCredito)}</td>
                    <td style={{ textAlign: "right" }}>{num(a.medianaHorasPorCredito)}</td>
                    <td style={{ textAlign: "right" }}>{a.alias}</td>
                    <td style={{ textAlign: "right" }}>{formatDate(a.ultimaActividad)}</td>
                    <td><Etiquetas a={a} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filas.length === 0 && <div className="center-note">Sin resultados.</div>}
        </>
      )}
    </>
  );
}
