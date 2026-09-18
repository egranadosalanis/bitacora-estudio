import { useEffect, useMemo, useState } from "react";
import { fetchUsers } from "./api.js";
import { formatDate, formatMinutes, PLAN_LABELS } from "./format.js";
import UserDetail from "./UserDetail.jsx";

const COLUMNS = [
  { key: "email", label: "Email", align: "left" },
  { key: "plan", label: "Plan", align: "left" },
  { key: "universidad", label: "Universidad", align: "left" },
  { key: "carrera", label: "Carrera", align: "left" },
  { key: "cursos", label: "Cursos", align: "right" },
  { key: "asignaturas", label: "Asignaturas", align: "right" },
  { key: "minutosTotal", label: "Minutos", align: "right" },
  { key: "ultimaActividad", label: "Última actividad", align: "right" },
  { key: "createdAt", label: "Alta", align: "right" },
];

export default function UsersView() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("minutosTotal");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetchUsers().then((d) => setUsers(d.users)).catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    let rows = users;
    if (q) {
      rows = rows.filter((u) =>
        [u.email, u.universidad, u.carrera].some((v) => (v || "").toLowerCase().includes(q))
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [users, query, sortKey, sortDir]);

  function toggleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (error) return <div className="error-box">{error}</div>;
  if (!users) return <div className="center-note">Cargando…</div>;

  if (selectedId) {
    return <UserDetail userId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <>
      <div className="search-row">
        <input
          type="text"
          placeholder="Buscar por email, universidad o carrera…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={sortKey === c.key ? "active-sort" : ""}
                  style={{ textAlign: c.align }}
                >
                  {c.label}
                  {sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="row-clickable" onClick={() => setSelectedId(u.id)}>
                <td>{u.email}</td>
                <td>
                  <span className="badge-plan">{PLAN_LABELS[u.plan] || u.plan}</span>
                </td>
                <td>{u.universidad || <span className="muted">—</span>}</td>
                <td>{u.carrera || <span className="muted">—</span>}</td>
                <td style={{ textAlign: "right" }}>{u.cursos}</td>
                <td style={{ textAlign: "right" }}>{u.asignaturas}</td>
                <td style={{ textAlign: "right" }}>{formatMinutes(u.minutosTotal)}</td>
                <td style={{ textAlign: "right" }}>{formatDate(u.ultimaActividad)}</td>
                <td style={{ textAlign: "right" }}>{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <div className="center-note">Sin resultados.</div>}
    </>
  );
}
