import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import {
  deleteAccountData, getNormalizationStatus, linkProfileToCanonical, linkAsignaturaToCanonical, markAsignaturaErasmus,
} from "./supabaseData.js";
import App, { CSS, CanonicalUniversidadPicker, CanonicalCarreraPicker, CanonicalAsignaturaPicker } from "./App.jsx";

const supportsPasskey = typeof window !== "undefined" && !!window.PublicKeyCredential;

function AuthForm() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'recover'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (err) throw err;
    } catch (err) {
      setError(err.message || String(err));
      setLoading(false);
    }
  }

  async function signInWithPasskey() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPasskey();
      if (err) throw err;
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

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
            <>
              <button
                type="button"
                className="auth-link"
                onClick={() => { setMode("recover"); setError(null); setInfo(null); }}
              >
                ¿Olvidaste tu contraseña?
              </button>
              <div className="auth-divider">o</div>
              <div className="btn-row">
                <button type="button" className="btn-ghost" disabled={loading} onClick={signInWithGoogle}>
                  Continuar con Google
                </button>
                {supportsPasskey && (
                  <button type="button" className="btn-ghost" disabled={loading} onClick={signInWithPasskey}>
                    Entrar con huella
                  </button>
                )}
              </div>
            </>
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

function CompleteProfileForm({ onSubmit }) {
  const [universidad, setUniversidad] = useState(null);
  const [carrera, setCarrera] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!universidad || !carrera) return;
    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        universidadId: universidad.id, universidadNombre: universidad.nombre,
        carreraId: carrera.id, carreraNombre: carrera.nombre,
      });
    } catch (err) {
      setError(err.message || String(err));
      setLoading(false);
    }
  }

  return (
    <div className="app-shell app-loading">
      <style>{CSS}</style>
      <div className="panel auth-card">
        <div className="panel-title">Antes de empezar</div>
        <p className="panel-subtitle">
          Cuéntanos dónde estudias — nos sirve para poder compararte más adelante con otros
          estudiantes de tu misma universidad y carrera. Si no la encuentras en la lista, puedes
          escribirla y quedará pendiente de revisión sin bloquearte.
        </p>
        <form onSubmit={submit}>
          <div className="field-row">
            <label className="field-label">Universidad</label>
            <CanonicalUniversidadPicker onSelect={(row) => { setUniversidad(row); setCarrera(null); }} />
          </div>
          <div className="field-row">
            <label className="field-label">Carrera</label>
            <CanonicalCarreraPicker universidadId={universidad?.id} onSelect={setCarrera} />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="btn-row">
            <button className="btn-primary" type="submit" disabled={loading || !universidad || !carrera}>
              {loading ? "…" : "Continuar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Pantalla obligatoria y sin botón de cerrar: se muestra una vez por
 * usuario, la primera vez que entra tras la actualización de
 * normalización, y bloquea el resto de la app hasta vincular (o
 * marcar Erasmus) TODAS sus asignaturas, de TODOS sus cursos — no
 * solo el curso activo. `status` viene de getNormalizationStatus() y
 * se recalcula en vivo después de cada acción: no hay ningún flag
 * guardado que se pueda falsificar para saltarse el paso. */
function NormalizationGate({ userId, status, initialUniversidadQuery, initialCarreraQuery, onStatusChange }) {
  const [universidadSel, setUniversidadSel] = useState(null);
  const [carreraSel, setCarreraSel] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [initialTotal, setInitialTotal] = useState(
    status.profileLinked && status.pendingSubjects.length > 0 ? status.pendingSubjects.length : null
  );

  useEffect(() => {
    if (status.profileLinked && initialTotal == null && status.pendingSubjects.length > 0) {
      setInitialTotal(status.pendingSubjects.length);
    }
  }, [status, initialTotal]);

  const resolvedCount = Math.max(0, (initialTotal ?? status.pendingSubjects.length) - status.pendingSubjects.length);

  async function refresh() {
    const next = await getNormalizationStatus(userId);
    onStatusChange(next);
  }

  async function withBusy(id, action) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusyId(null);
    }
  }

  const confirmProfileLink = () =>
    withBusy("profile", () => linkProfileToCanonical(userId, { universidadId: universidadSel.id, carreraId: carreraSel.id }));

  const subjectsByCurso = new Map();
  status.pendingSubjects.forEach((s) => {
    const key = s.cursoName || "Sin curso";
    if (!subjectsByCurso.has(key)) subjectsByCurso.set(key, []);
    subjectsByCurso.get(key).push(s);
  });

  return (
    <div className="app-shell app-loading">
      <style>{CSS}</style>
      <div className="panel auth-card" style={{ maxWidth: 560 }}>
        <div className="panel-title">Antes de continuar</div>
        <p className="panel-subtitle">
          Hemos pasado a un listado compartido de universidades, carreras y asignaturas para poder comparar tus
          datos con los de otros estudiantes de forma fiable. Este paso es obligatorio, pero corto — no volverá
          a pedirse.
        </p>

        {!status.profileLinked && (
          <div style={{ marginBottom: 18 }}>
            <div className="field-row">
              <label className="field-label">Universidad</label>
              <CanonicalUniversidadPicker
                initialQuery={initialUniversidadQuery}
                onSelect={(row) => { setUniversidadSel(row); setCarreraSel(null); }}
              />
            </div>
            <div className="field-row">
              <label className="field-label">Carrera</label>
              <CanonicalCarreraPicker universidadId={universidadSel?.id} initialQuery={initialCarreraQuery} onSelect={setCarreraSel} />
            </div>
            <div className="btn-row">
              <button
                className="btn-primary"
                disabled={!universidadSel || !carreraSel || busyId === "profile"}
                onClick={confirmProfileLink}
              >
                {busyId === "profile" ? "…" : "Confirmar"}
              </button>
            </div>
          </div>
        )}

        {status.profileLinked && status.pendingSubjects.length > 0 && (
          <div>
            <p className="panel-subtitle">
              {resolvedCount} de {initialTotal ?? status.pendingSubjects.length} asignatura(s) resueltas — de todos tus cursos, no solo el actual.
            </p>
            {Array.from(subjectsByCurso.entries()).map(([cursoName, subs]) => (
              <div key={cursoName} style={{ marginBottom: 16 }}>
                <div className="panel-title" style={{ fontSize: 13 }}>{cursoName}</div>
                {subs.map((s) => (
                  <div key={s.id} className="field-row" style={{ alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 130 }}>
                      <div>{s.name}</div>
                      <div className="gauge-sub">{s.credits} créditos</div>
                    </div>
                    <CanonicalAsignaturaPicker
                      carreraId={status.carreraCanonicaId}
                      initialQuery={s.name}
                      onSelect={(row) => withBusy(s.id, () => linkAsignaturaToCanonical(userId, s.id, row.id))}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-small"
                      disabled={busyId === s.id}
                      onClick={() => withBusy(s.id, () => markAsignaturaErasmus(userId, s.id, true))}
                    >
                      Es Erasmus
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
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
  // undefined = comprobando; luego el objeto de getNormalizationStatus().
  const [normStatus, setNormStatus] = useState(undefined);
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
      setProfileError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (cancelled) return;
      if (!error) {
        setProfile(data);
        return;
      }
      // PGRST116: la consulta no encontró ninguna fila — pasa si el perfil
      // se borró a mano (p. ej. al "eliminar cuenta" desde fuera de la app,
      // o manualmente en Supabase) pero la cuenta de autenticación sigue
      // existiendo. En vez de quedarse atascado con un error, se crea un
      // perfil nuevo y se sigue como si fuera una cuenta recién registrada.
      if (error.code === "PGRST116") {
        const { data: created, error: insertError } = await supabase
          .from("profiles")
          .insert({ id: session.user.id, email: session.user.email, plan: "free" })
          .select()
          .single();
        if (cancelled) return;
        if (insertError) setProfileError(insertError.message);
        else setProfile(created);
        return;
      }
      setProfileError(error.message);
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Solo se comprueba el estado de normalización una vez que el usuario ya
  // pasó la pantalla de "Antes de empezar" (tiene universidad/carrera).
  useEffect(() => {
    if (!profile || !profile.universidad || !profile.carrera) {
      setNormStatus(undefined);
      return;
    }
    let cancelled = false;
    getNormalizationStatus(profile.id)
      .then((s) => { if (!cancelled) setNormStatus(s); })
      .catch((err) => { if (!cancelled) setProfileError(err.message || String(err)); });
    return () => { cancelled = true; };
  }, [profile]);

  async function completeProfile({ universidadId, universidadNombre, carreraId, carreraNombre }) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        universidad: universidadNombre, carrera: carreraNombre,
        universidad_canonica_id: universidadId, carrera_canonica_id: carreraId,
      })
      .eq("id", session.user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
  }

  // Borra el perfil del usuario — por cascada (on delete cascade en el
  // esquema) se borran también todos sus cursos, asignaturas y registros
  // de estudio. No borra la cuenta de autenticación en sí (eso requiere la
  // service role key, que no puede usarse desde el cliente): la cuenta
  // podría volver a iniciar sesión con el mismo email/contraseña, y
  // arrancaría de cero como si fuera nueva, gracias al mismo mecanismo de
  // arriba que crea un perfil cuando no encuentra ninguno.
  async function deleteAccount() {
    await deleteAccountData(session.user.id);
    await supabase.auth.signOut();
  }

  if (session === undefined) return <LoadingScreen text="Cargando…" />;
  if (passwordRecovery) return <SetNewPassword />;
  if (!session) return <AuthForm />;
  if (profileError) {
    return (
      <div className="app-shell app-loading">
        <style>{CSS}</style>
        <div className="panel auth-card">
          <div className="panel-title">Error cargando el perfil</div>
          <div className="auth-error">{profileError}</div>
          <div className="btn-row">
            <button className="btn-primary" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    );
  }
  if (!profile) return <LoadingScreen text="Cargando perfil…" />;
  if (!profile.universidad || !profile.carrera) return <CompleteProfileForm onSubmit={completeProfile} />;
  if (normStatus === undefined) return <LoadingScreen text="Comprobando tu universidad y asignaturas…" />;
  if (!normStatus.done) {
    return (
      <NormalizationGate
        userId={session.user.id}
        status={normStatus}
        initialUniversidadQuery={profile.universidad}
        initialCarreraQuery={profile.carrera}
        onStatusChange={setNormStatus}
      />
    );
  }

  return (
    <App
      session={session}
      profile={profile}
      onSignOut={() => supabase.auth.signOut()}
      onDeleteAccount={deleteAccount}
    />
  );
}
