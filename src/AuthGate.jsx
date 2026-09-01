import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import App, { CSS } from "./App.jsx";

function AuthForm() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'recover'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        setInfo("Cuenta creada. Si tu proyecto pide confirmar el email, revisa tu bandeja de entrada antes de iniciar sesión.");
      } else if (mode === "recover") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (err) throw err;
        setInfo("Te hemos enviado un email con un enlace para elegir una contraseña nueva.");
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
        <div className="panel-title">
          {mode === "login" ? "Iniciar sesión" : mode === "signup" ? "Crear cuenta" : "Recuperar contraseña"}
        </div>
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
          {mode !== "recover" && (
            <div className="field-row">
              <label className="field-label">Contraseña</label>
              <div className="password-field">
                <input
                  className="input-field"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}
          <div className="btn-row">
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "…" : mode === "login" ? "Entrar" : mode === "signup" ? "Crear cuenta" : "Enviar enlace"}
            </button>
            {mode !== "recover" && (
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
            )}
          </div>
          {mode === "login" && (
            <button
              type="button"
              className="auth-link"
              onClick={() => { setMode("recover"); setError(null); setInfo(null); }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {mode === "recover" && (
            <button
              type="button"
              className="auth-link"
              onClick={() => { setMode("login"); setError(null); setInfo(null); }}
            >
              Volver a iniciar sesión
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function SetNewPassword() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
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
        <div className="panel-title">Elige tu contraseña nueva</div>
        {done ? (
          <div className="auth-info">Contraseña actualizada. Ya puedes recargar la página y usar la app con normalidad.</div>
        ) : (
          <form onSubmit={submit}>
            <div className="field-row">
              <label className="field-label">Contraseña nueva</label>
              <div className="password-field">
                <input
                  className="input-field"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="btn-row">
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "…" : "Guardar contraseña"}
              </button>
            </div>
          </form>
        )}
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
  // Se activa cuando el enlace de "recuperar contraseña" del email trae un
  // token de recuperación — Supabase abre una sesión temporal solo para
  // poder elegir la contraseña nueva, no para entrar en la app todavía.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(s);
    });
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
  if (passwordRecovery) return <SetNewPassword />;
  if (!session) return <AuthForm />;
  if (profileError) return <LoadingScreen text={`Error cargando el perfil: ${profileError}`} />;
  if (!profile) return <LoadingScreen text="Cargando perfil…" />;

  return <App session={session} profile={profile} onSignOut={() => supabase.auth.signOut()} />;
}
