import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import Login from "./Login.jsx";
import Overview from "./Overview.jsx";
import UsersView from "./UsersView.jsx";
import NormalizationQueue from "./NormalizationQueue.jsx";
import AsignaturaStats from "./AsignaturaStats.jsx";
import { fetchMaintenance, setMaintenance as postMaintenance } from "./api.js";

function MaintenanceToggle() {
  const [state, setState] = useState(undefined); // undefined = cargando
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMaintenance().then(setState).catch((err) => setError(err.message));
  }, []);

  async function toggle() {
    if (!state) return;
    const next = !state.enabled;
    if (next && !window.confirm("¿Suspender la app para todos los usuarios? Nadie podrá entrar hasta que la reactives.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await postMaintenance(next, state.message || "");
      setState(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <span className="error-box" style={{ margin: 0 }}>{error}</span>;
  if (!state) return null;

  return (
    <button
      className={`btn ${state.enabled ? "btn-danger" : ""}`}
      onClick={toggle}
      disabled={busy}
      title={state.enabled ? "La app está suspendida: nadie puede acceder" : "Suspender la app para todos los usuarios"}
    >
      {busy ? "…" : state.enabled ? "🔴 App suspendida — reanudar" : "Suspender app"}
    </button>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = comprobando
  const [tab, setTab] = useState("overview");
  const [theme, setTheme] = useState(
    () => (typeof window !== "undefined" && window.localStorage.getItem("bitacora_admin_theme")) || "dark"
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem("bitacora_admin_theme", theme);
    } catch {
      // Modo privado / almacenamiento bloqueado: el tema no se recuerda
      // entre sesiones, pero sigue funcionando en esta.
    }
  }, [theme]);

  if (session === undefined) return <div className="center-note">Cargando…</div>;
  if (!session) return <Login />;

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          Bitácora <span className="brand-sub">Admin</span>
        </div>
        <div className="topbar-right">
          <span className="user-email">{session.user.email}</span>
          <MaintenanceToggle />
          <button
            className="btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {theme === "dark" ? "☀️ Claro" : "🌙 Oscuro"}
          </button>
          <button className="btn" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
          Resumen
        </button>
        <button className={`tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
          Usuarios
        </button>
        <button className={`tab ${tab === "normalizacion" ? "active" : ""}`} onClick={() => setTab("normalizacion")}>
          Normalización
        </button>
        <button className={`tab ${tab === "asignaturas" ? "active" : ""}`} onClick={() => setTab("asignaturas")}>
          Asignaturas
        </button>
      </div>

      <div className="content">
        {tab === "overview" && <Overview />}
        {tab === "users" && <UsersView />}
        {tab === "normalizacion" && <NormalizationQueue />}
        {tab === "asignaturas" && <AsignaturaStats />}
      </div>
    </div>
  );
}
