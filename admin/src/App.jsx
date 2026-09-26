import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import Login from "./Login.jsx";
import Overview from "./Overview.jsx";
import UsersView from "./UsersView.jsx";
import NormalizationQueue from "./NormalizationQueue.jsx";

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
      </div>

      <div className="content">
        {tab === "overview" && <Overview />}
        {tab === "users" && <UsersView />}
        {tab === "normalizacion" && <NormalizationQueue />}
      </div>
    </div>
  );
}
