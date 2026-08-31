import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import App, { CSS } from "./App.jsx";

function AuthForm() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setInfo("Cuenta creada. Si tu proyecto pide confirmar el email, revisa tu bandeja de entrada antes de iniciar sesión.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell app-loading">
      <style>{CSS}</style>
      <div className="panel auth-card">
        <div className="panel-title">{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</div>
        <form onSubmit={submit}>
          <div className="field-row">
            <label className="field-label">Email</label>
            <input
              className="input-field"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field-row">
            <label className="field-label">Contraseña</label>
            <input
              className="input-field"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}
          <div className="btn-row">
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "…" : mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                setMode((m) => (m === "login" ? "signup" : "login"));
                setError(null);
                setInfo(null);
              }}
            >
              {mode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <div className="app-shell app-loading">
      <style>{CSS}</style>
      <div className="mono" style={{ color: "#8291AC" }}>{text}</div>
    </div>
  );
}

export default function AuthGate() {
  // undefined = comprobando si hay sesión guardada; null = sin sesión
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) setProfileError(error.message);
        else setProfile(data);
      });
  }, [session]);

  if (session === undefined) return <LoadingScreen text="Cargando…" />;
  if (!session) return <AuthForm />;
  if (profileError) return <LoadingScreen text={`Error cargando el perfil: ${profileError}`} />;
  if (!profile) return <LoadingScreen text="Cargando perfil…" />;

  return <App session={session} profile={profile} onSignOut={() => supabase.auth.signOut()} />;
}
