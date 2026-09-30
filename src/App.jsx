import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  PALETTE, SUBJECT_COLORS, uid, isoToday, addDays, formatShort, formatLong, formatMedium, hm,
  computeStats, buildEntriesFromLogs, getSubjectEntries, getAllEntriesFlat,
  computeDesgaste, freezeApproval, computeClassification,
  inferCursoRange, entriesInRange, subjectsWithActivityInRange, subjectsForRegisterInCurso,
  APP_SHARE_URL,
} from "./domain.js";
import {
  loadUserData, insertEntries, updateEntryMinutes, deleteEntry, EntryNotFoundError, insertSubject, deleteSubject, updateSubject,
  updateSubjectEstado, approveSubject, insertCurso, updateCursoEstado, deleteCurso,
  searchUniversidades, searchCarreras, searchAsignaturasCanonicas,
  createUniversidadPendiente, createCarreraPendiente, createAsignaturaPendiente,
} from "./supabaseData.js";
import { supabase } from "./supabaseClient.js";
import { OFFLINE_MESSAGE, friendlyError, isNetworkError } from "./offline.js";
import SocialTab, { SOCIAL_CSS, SocialSettingsModal } from "./SocialTab.jsx";
import { readPendingInvite, clearPendingInvite, getMiPerfilSocial, photoUrl, GOOGLE_AVATAR_RE } from "./socialData.js";
import { AccountAvatar, AVATAR_CSS } from "./Avatar.jsx";
import RangosTab, { prefetchRangosImages } from "./RangosTab.jsx";

/* ------------------------------------------------------------------ */
/*  COMPONENTES DE UI GENERICOS                                        */
/* ------------------------------------------------------------------ */

function Gauge({ label, value, max, unit, target, color, sub }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const targetPct = target != null && max > 0 ? Math.min(100, (target / max) * 100) : null;
  return (
    <div className="gauge-row">
      <div className="gauge-head">
        <span className="gauge-label">{label}</span>
        <span className="gauge-value">
          {value.toFixed(2)}<span className="gauge-unit">{unit}</span>
        </span>
      </div>
      <div className="gauge-track">
        <div className="gauge-ticks">
          {Array.from({ length: 11 }).map((_, i) => (
            <span key={i} className="gauge-tick" style={{ left: `${i * 10}%` }} />
          ))}
        </div>
        <div className="gauge-fill" style={{ width: `${pct}%`, background: color }} />
        {targetPct != null && (
          <div className="gauge-target" style={{ left: `${targetPct}%` }} title={`Referencia: ${target.toFixed(2)}`} />
        )}
      </div>
      {sub && <div className="gauge-sub">{sub}</div>}
    </div>
  );
}

function StatCard({ label, value, hint, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

function Tab({ id, active, onClick, children }) {
  return (
    <button className={`tab-btn ${active ? "tab-btn-active" : ""}`} onClick={() => onClick(id)}>
      {children}
    </button>
  );
}

/** true en pantallas de móvil (mismo corte que el CSS: 640 px). */
function useIsMobile() {
  const query = "(max-width: 640px)";
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/* Iconos de trazo (grosor 1,8), sin emojis, para la navegación móvil. */
const NAV_ICON_PATHS = {
  bitacora: <><path d="M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2z" /><path d="M6 19a2 2 0 0 1 2-2h11" /></>,
  trayectoria: <><path d="M3 17l6-6 4 4 8-9" /><path d="M15 6h6v6" /></>,
  panel: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  rangos: <path d="M6 11l6-6 6 6M6 19l6-6 6 6" />,
  mas: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  desgaste: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  clasificacion: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></>,
  social: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14a5 5 0 0 1 6 5" /></>,
  asignaturas: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  excel: <path d="M12 4v11M8 11l4 4 4-4M5 20h14" />,
  novedades: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  reportar: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  flecha: <path d="M9 6l6 6-6 6" />,
  huella: <><path d="M12 11v3a5 5 0 0 1-1.5 3.6" /><path d="M8 11a4 4 0 0 1 8 0v1.5" /><path d="M5 12a7 7 0 0 1 14 0v1" /><path d="M9 19c1-1 1.5-2.4 1.5-4" /><path d="M15 12v3c0 2-.6 3.6-1.8 5" /></>,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  luna: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  salir: <><path d="M10 4H5v16h5" /><path d="M15 8l4 4-4 4M19 12H9" /></>,
  borrar: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  volver: <path d="M15 6l-6 6 6 6" />,
  web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18" /><path d="M12 3a14 14 0 0 0 0 18" /></>,
};

function NavIcon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {NAV_ICON_PATHS[name]}
    </svg>
  );
}

const BOTTOM_TABS = [
  { id: "bitacora", label: "Bitácora" },
  { id: "trayectoria", label: "Trayect." },
  { id: "panel", label: "Panel" },
  { id: "social", label: "Social" },
];

/** Barra inferior fija del móvil: 4 secciones + "Más". */
function BottomNav({ tab, moreOpen, newsDot, onSelect, onMore }) {
  const masActive = moreOpen || !BOTTOM_TABS.some((t) => t.id === tab);
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {BOTTOM_TABS.map((t) => {
        const active = !moreOpen && tab === t.id;
        return (
          <button key={t.id} className={`bn-item ${active ? "bn-active" : ""}`} onClick={() => onSelect(t.id)} aria-current={active ? "page" : undefined}>
            <span className="bn-icon"><NavIcon name={t.id} /></span>
            <span className="bn-label">{t.label}</span>
          </button>
        );
      })}
      <button className={`bn-item ${masActive ? "bn-active" : ""}`} onClick={onMore} aria-expanded={moreOpen}>
        <span className="bn-icon">
          <NavIcon name="mas" />
          {newsDot && <span className="bn-dot" />}
        </span>
        <span className="bn-label">Más</span>
      </button>
    </nav>
  );
}

/** Fila del menú de cuenta en PC: mismo estilo que el panel "Más" del móvil (icono + texto). */
function AccRow({ icon, children, dot, disabled, danger, title, href, onClick }) {
  const inner = (
    <>
      <span className="acc-icon"><NavIcon name={icon} size={16} /></span>
      <span className="acc-text">{children}</span>
      {dot && <span className="bn-dot bn-dot-inline" />}
    </>
  );
  if (href) {
    return <a className="acc-row" href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>{inner}</a>;
  }
  return (
    <button type="button" className={`acc-row ${danger ? "acc-row-danger" : ""}`} onClick={onClick} disabled={disabled} title={title}>
      {inner}
    </button>
  );
}

function MoreRow({ icon, children, pill, dot, disabled, title, onClick }) {
  return (
    <button className="more-row" onClick={onClick} disabled={disabled} title={title}>
      <span className="more-row-icon"><NavIcon name={icon} size={20} /></span>
      <span className="more-row-text">{children}</span>
      {pill && <span className="pronto-pill">PRONTO</span>}
      {dot && <span className="bn-dot bn-dot-inline" />}
      <span className="more-row-arrow"><NavIcon name="flecha" size={18} /></span>
    </button>
  );
}

/** Panel "Más" (móvil): sube desde abajo con Secciones y Herramientas. */
function MoreSheet({ onClose, onGo, newsDot, isPremium, exportBusy, onExport, onNews, onReport }) {
  return (
    <div className="more-overlay" onClick={onClose}>
      <div className="more-sheet" role="dialog" aria-label="Más" onClick={(e) => e.stopPropagation()}>
        <div className="more-handle" />
        <div className="more-section">SECCIONES</div>
        <MoreRow icon="rangos" onClick={() => onGo("rangos")}>Rangos</MoreRow>
        <MoreRow icon="desgaste" onClick={() => onGo("desgaste")}>Desgaste</MoreRow>
        <MoreRow icon="clasificacion" onClick={() => onGo("clasificacion")}>Clasificación</MoreRow>
        <div className="more-divider" />
        <div className="more-section">HERRAMIENTAS</div>
        <MoreRow icon="asignaturas" onClick={() => onGo("asignaturas")}>Mis asignaturas</MoreRow>
        <MoreRow
          icon="excel" onClick={onExport} disabled={!isPremium || exportBusy}
          title={isPremium ? undefined : "Exportar a Excel está disponible en los planes de pago"}
        >
          {exportBusy ? "Generando…" : "Exportar a Excel"}
        </MoreRow>
        <MoreRow icon="novedades" dot={newsDot} onClick={onNews}>Novedades</MoreRow>
        <MoreRow icon="web" onClick={() => window.open(APP_SHARE_URL, "_blank", "noopener,noreferrer")}>Web de Clever</MoreRow>
        <MoreRow icon="reportar" onClick={onReport}>Reportar un problema</MoreRow>
      </div>
    </div>
  );
}

const ESTADO_LABELS = { en_curso: "En curso", suspendida: "Suspendida", aprobada: "Aprobada" };

function EstadoBadge({ estado }) {
  return <span className={`badge-estado badge-estado-${estado}`}>{ESTADO_LABELS[estado] || estado}</span>;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box ${wide ? "modal-box-wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Se muestra en vez del contenido de una vista reservada a planes de
 * pago, cuando el usuario está en el plan free. Los datos de esa vista
 * siguen existiendo y guardándose con normalidad — esto solo oculta la
 * pantalla. */
function PremiumLocked({ feature }) {
  return (
    <div className="panel">
      <div className="panel-title">Función premium</div>
      <div className="empty-hint">
        {feature} está disponible en los planes de pago. Tus datos se siguen registrando con normalidad —
        en cuanto actualices tu plan podrás verla con todo tu historial.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: BITACORA (registro diario + historial completo)               */
/* ------------------------------------------------------------------ */

const HISTORY_ALL = ""; // sentinel: "Histórico (todas las asignaturas)"

function clampDate(d, min, max) {
  if (d < min) return min;
  if (d > max) return max;
  return d;
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// "draft2": desde que el formulario son "minutos a añadir" (entradas
// individuales), los borradores antiguos —que guardaban el total del día—
// ya no significan lo mismo y no deben recuperarse, o se sumarían dos veces.
const DRAFT_PREFIX = "bitacora:draft2:";

/** UUID v4 para cada entrada nueva (se genera en el dispositivo para que un
 * reintento del mismo guardado no la duplique). */
function newUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Identificador anónimo y persistente de este dispositivo/navegador. */
function getDeviceId() {
  try {
    let id = localStorage.getItem("bitacora:deviceId");
    if (!id) {
      id = newUuid();
      localStorage.setItem("bitacora:deviceId", id);
    }
    return id;
  } catch {
    return null;
  }
}

const MAX_MINUTES_PER_ENTRY = 1440;

/** Valida los minutos de un campo: devuelve { minutes } (0 si está vacío)
 * o { error } si no es un entero entre 0 y MAX_MINUTES_PER_ENTRY. */
function parseMinutes(raw) {
  const str = String(raw ?? "").trim();
  if (str === "") return { minutes: 0 };
  const n = Number(str);
  if (!Number.isInteger(n)) return { error: "tiene que ser un número entero de minutos" };
  if (n < 0) return { error: "no puede ser negativo" };
  if (n > MAX_MINUTES_PER_ENTRY) return { error: `no puede pasar de ${MAX_MINUTES_PER_ENTRY} min por entrada` };
  return { minutes: n };
}

function formatTime(isoTs) {
  const d = new Date(isoTs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// El registro manual sin guardar y el contador viven en memoria (useState).
// En móvil, al poner la app en segundo plano el sistema puede recargar la
// página al volver, perdiendo esa memoria. Estas funciones guardan un
// borrador en localStorage para poder recuperarlo tras esa recarga.
function loadDraft(cursoId) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + cursoId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(cursoId, draft) {
  try {
    localStorage.setItem(DRAFT_PREFIX + cursoId, JSON.stringify(draft));
  } catch {
    // Sin localStorage disponible (privado, cuota, etc.) el registro sigue
    // funcionando en memoria, solo se pierde la recuperación tras recargar.
  }
}

/** ¿Tiene el borrador algo que se perdería (minutos escritos, contador con
 * tiempo o un guardado sin confirmar)? */
function draftHasContent(draft) {
  if (!draft) return false;
  const typed = Object.values(draft.values || {}).some((v) => (parseMinutes(v).minutes || 0) > 0);
  return typed || !!draft.timerRunning || draft.timerAccumulatedMs > 0 || !!draft.pendingSave;
}

function BitacoraTab({ cursoSubjects, loggableSubjects, entries, logs, onSaveEntries, onUpdateEntry, onDeleteEntry, curso }) {
  const todayIso = isoToday();
  const cappedToday = todayIso < curso.endDate ? todayIso : curso.endDate;
  // Si el curso todavía no ha empezado, no hay "hoy" válido dentro de su rango:
  // se permite todo el curso en vez de bloquear cualquier fecha.
  const maxDate = cappedToday >= curso.startDate ? cappedToday : curso.endDate;
  const minDate = curso.startDate;

  // Arranca en hoy — salvo que haya un borrador pendiente de otro día dentro
  // del curso (p. ej. el contador seguía en marcha pasada la medianoche y el
  // móvil recargó la página): entonces se vuelve a ese día para no perderlo.
  const [date, setDate] = useState(() => {
    const draft = loadDraft(curso.id);
    if (draftHasContent(draft) && draft.date >= minDate && draft.date <= maxDate) return draft.date;
    return clampDate(todayIso, minDate, maxDate);
  });
  // Minutos A AÑADIR por asignatura (no el total del día): siempre arrancan
  // vacíos y cada "Guardar" crea una entrada nueva por asignatura con > 0.
  const [values, setValues] = useState({});
  const [historySubjectId, setHistorySubjectId] = useState(HISTORY_ALL);
  const [visibleCount, setVisibleCount] = useState(20);

  const [mode, setMode] = useState("manual"); // 'manual' | 'contador'
  const [timerSubjectId, setTimerSubjectId] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [timerAccumulatedMs, setTimerAccumulatedMs] = useState(0);
  const [, setTimerTick] = useState(0);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // bloquea el doble toque antes de que React repinte
  // Entradas (con sus ids) del guardado en curso o del último que falló. Se
  // guarda también en el borrador: si se reintenta sin cambiar nada —aunque
  // sea tras una recarga porque el sistema cerró la app a mitad de guardar—
  // se reenvían con los MISMOS ids, así que si el primer intento sí llegó al
  // servidor no se duplican.
  const pendingSaveRef = useRef(null);
  const prevCursoIdRef = useRef(curso.id);
  const [formMsg, setFormMsg] = useState(null); // { type: 'ok' | 'error', text }
  // Widget derecho: "Registros de hoy" (totales del día por asignatura, que
  // se despliegan en sus sesiones) o "Últimos registros" (totales por día).
  const [listView, setListView] = useState("hoy"); // 'hoy' | 'ultimos'
  // Día que muestra "Registros de hoy": sigue a la fecha del formulario, pero
  // tocar un día en "Últimos registros" lo cambia SOLO aquí, sin mover el
  // formulario (así no se pierde lo escrito ni se reinicia el contador).
  const [viewDate, setViewDate] = useState(date);
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);
  const [sessionEdits, setSessionEdits] = useState({}); // { [entryId]: texto }
  const [sessionErrors, setSessionErrors] = useState({}); // { [entryId]: mensaje }
  const [sessionBusyId, setSessionBusyId] = useState(null);
  const [listMsg, setListMsg] = useState(null);

  useEffect(() => { setViewDate(date); }, [date]);

  // Al cambiar de curso, la fecha y la asignatura de historial seleccionadas
  // pueden quedar fuera de rango o dejar de existir en el nuevo curso — se
  // resetean para que los registros siempre se guarden en el curso activo.
  useEffect(() => {
    if (prevCursoIdRef.current === curso.id) return; // al montar no: ahí manda el borrador
    prevCursoIdRef.current = curso.id;
    setDate(clampDate(isoToday(), minDate, maxDate));
    setHistorySubjectId(HISTORY_ALL);
  }, [curso.id]);

  // Al cambiar de fecha o de curso, el formulario vuelve a 0 — salvo que haya
  // un borrador sin guardar en localStorage para ese mismo curso y fecha (p.
  // ej. porque el móvil recargó la página al volver de segundo plano), que se
  // recupera, incluido el contador si seguía en marcha (su tiempo se
  // recalcula contra timerStartedAt, un timestamp real). No depende de los
  // datos del servidor: refrescarlos (al guardar o al volver a la pestaña)
  // nunca borra lo que se está escribiendo.
  useEffect(() => {
    const draft = loadDraft(curso.id);
    const useDraft = !!draft && draft.date === date;
    setValues(useDraft ? draft.values || {} : {});
    pendingSaveRef.current = useDraft ? draft.pendingSave || null : null;
    setFormMsg(
      useDraft && date !== isoToday() && draftHasContent(draft)
        ? { type: "ok", text: `Recuperado lo que tenías sin guardar del ${formatLong(date)}: se guardará en ese día (cámbialo arriba si quieres otro).` }
        : null
    );
    if (useDraft) {
      setMode(draft.mode || "manual");
      if (draft.timerSubjectId) setTimerSubjectId(draft.timerSubjectId);
      setTimerRunning(!!draft.timerRunning);
      setTimerStartedAt(draft.timerStartedAt ?? null);
      setTimerAccumulatedMs(draft.timerAccumulatedMs || 0);
    } else {
      setTimerRunning(false);
      setTimerStartedAt(null);
      setTimerAccumulatedMs(0);
    }
  }, [date, curso.id]);

  // Persiste el borrador en cada cambio, para poder recuperarlo si el
  // sistema recarga la página mientras la app está en segundo plano.
  function persistDraft() {
    saveDraft(curso.id, {
      date, values, mode, timerSubjectId, timerRunning, timerStartedAt, timerAccumulatedMs, pendingSave: pendingSaveRef.current,
    });
  }
  useEffect(persistDraft, [curso.id, date, values, mode, timerSubjectId, timerRunning, timerStartedAt, timerAccumulatedMs]);

  useEffect(() => { setVisibleCount(20); }, [historySubjectId]);

  // Si la asignatura del contador desaparece de la lista (aprobada, borrada,
  // o simplemente porque `loggableSubjects` se recalculó de golpe tras un
  // refresco de datos —p. ej. al volver de vincularla a una canónica— y por
  // un instante no la incluye), NUNCA se reasigna sola a otra en silencio:
  // eso metería los minutos acumulados en la asignatura equivocada al pulsar
  // "Fin". Si había tiempo acumulado o el contador seguía en marcha, se
  // pausa (sin perder ese tiempo) y se obliga a elegir asignatura a mano;
  // solo se autoselecciona la primera cuando de verdad no había nada que
  // perder (arranque, o contador a 00:00).
  useEffect(() => {
    const stillValid = timerSubjectId && loggableSubjects.some((s) => s.id === timerSubjectId);
    if (stillValid) return;
    const hasPendingTime = timerRunning || timerAccumulatedMs > 0;
    if (hasPendingTime) {
      if (timerRunning) pauseTimer();
      if (timerSubjectId) {
        setTimerSubjectId(null);
        setFormMsg({
          type: "error",
          text: "La asignatura del contador ya no está disponible. Se ha pausado sin perder el tiempo acumulado — elige otra asignatura para continuar.",
        });
      }
      return;
    }
    // Forma funcional: al montar, el efecto que recupera el borrador (más
    // arriba) y este se ejecutan en el mismo commit. Con un valor directo,
    // este pisaba la asignatura recuperada con la primera de la lista
    // (cierre obsoleto con timerSubjectId a null) — y el contador restaurado
    // acababa guardando sus minutos en esa primera asignatura.
    setTimerSubjectId((cur) => (cur && loggableSubjects.some((s) => s.id === cur) ? cur : loggableSubjects[0]?.id ?? null));
  }, [loggableSubjects, timerSubjectId, timerRunning, timerAccumulatedMs]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimerTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const timerElapsedMs = timerAccumulatedMs + (timerRunning && timerStartedAt ? Date.now() - timerStartedAt : 0);

  function startTimer() {
    setTimerStartedAt(Date.now());
    setTimerRunning(true);
  }
  function pauseTimer() {
    setTimerAccumulatedMs((ms) => ms + (timerStartedAt ? Date.now() - timerStartedAt : 0));
    setTimerStartedAt(null);
    setTimerRunning(false);
  }
  function finishTimer() {
    const totalMs = timerAccumulatedMs + (timerRunning && timerStartedAt ? Date.now() - timerStartedAt : 0);
    const addedMinutes = Math.round(totalMs / 60000);
    if (addedMinutes > 0 && timerSubjectId) {
      setValues((v) => ({ ...v, [timerSubjectId]: String((parseInt(v[timerSubjectId], 10) || 0) + addedMinutes) }));
    }
    setTimerAccumulatedMs(0);
    setTimerStartedAt(null);
    setTimerRunning(false);
  }
  function resetTimer() {
    setTimerAccumulatedMs(0);
    setTimerStartedAt(null);
    setTimerRunning(false);
  }

  const subjectById = new Map(cursoSubjects.map((s) => [s.id, s]));
  const pendingTotal = loggableSubjects.reduce((acc, s) => acc + (parseMinutes(values[s.id]).minutes || 0), 0);

  function collectRows() {
    const rows = [];
    const errors = [];
    loggableSubjects.forEach((s) => {
      const r = parseMinutes(values[s.id]);
      if (r.error) errors.push(`${s.name}: ${r.error}`);
      else if (r.minutes > 0) rows.push({ subjectId: s.id, minutes: r.minutes });
    });
    return { rows, errors, signature: JSON.stringify([date, rows]) };
  }

  // Si hay un guardado sin confirmar (la app se cerró o perdió la respuesta
  // a mitad) y sus entradas ya aparecen en los datos del servidor, es que sí
  // llegó: se limpia el formulario en vez de invitar a guardarlo otra vez.
  // Solo si lo escrito sigue siendo exactamente lo de aquel guardado.
  useEffect(() => {
    const pending = pendingSaveRef.current;
    if (!pending || savingRef.current) return;
    const ids = new Set(logs.map((l) => l.id));
    if (!pending.logs.every((l) => ids.has(l.id))) return;
    if (collectRows().signature !== pending.signature) return;
    pendingSaveRef.current = null;
    setValues({});
    const added = pending.logs.reduce((a, l) => a + l.minutes, 0);
    setFormMsg({ type: "ok", text: `Tu último guardado sí se completó (${pending.logs.length} entrada(s), +${hm(added)}).` });
  }, [logs, values]);

  async function handleSave() {
    if (savingRef.current) return;
    const { rows, errors, signature } = collectRows();
    if (errors.length > 0) {
      setFormMsg({ type: "error", text: errors.join(" · ") });
      return;
    }
    if (rows.length === 0) {
      setFormMsg({ type: "error", text: "No hay minutos que guardar: escribe los minutos a añadir en alguna asignatura." });
      return;
    }
    if (pendingSaveRef.current?.signature !== signature) {
      pendingSaveRef.current = { signature, logs: rows.map((r) => ({ ...r, id: newUuid(), date })) };
    }
    const toSave = pendingSaveRef.current.logs;
    persistDraft(); // apunta los ids ANTES de enviar, por si la app se cierra a mitad
    savingRef.current = true;
    setSaving(true);
    setFormMsg(null);
    try {
      await onSaveEntries(toSave);
      pendingSaveRef.current = null;
      setValues({});
      const added = toSave.reduce((a, l) => a + l.minutes, 0);
      setFormMsg({ type: "ok", text: `Guardado: ${toSave.length} entrada(s), +${hm(added)}.` });
    } catch (e) {
      setFormMsg({
        type: "error",
        text: isNetworkError(e)
          ? `${friendlyError(e)}. Tus minutos siguen en el formulario: pulsa "Guardar registro" para reintentar.`
          : `No se pudo guardar (${String((e && e.message) || e)}). Tus minutos siguen en el formulario: pulsa "Guardar registro" para reintentar.`,
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function setSessionError(id, msg) {
    setSessionErrors((m) => ({ ...m, [id]: msg }));
  }
  function forgetSessionEdit(id) {
    setSessionEdits(({ [id]: _drop, ...rest }) => rest);
    setSessionErrors(({ [id]: _drop, ...rest }) => rest);
  }

  async function handleSessionSave(log) {
    const r = parseMinutes(sessionEdits[log.id]);
    if (r.error) return setSessionError(log.id, `Los minutos ${r.error}.`);
    if (r.minutes === 0) return setSessionError(log.id, "Para quitar esta sesión, usa ✕.");
    if (r.minutes === log.minutes) return forgetSessionEdit(log.id);
    setSessionBusyId(log.id);
    setSessionError(log.id, null);
    setListMsg(null);
    try {
      await onUpdateEntry(log.id, r.minutes);
      forgetSessionEdit(log.id);
      setListMsg({ type: "ok", text: `Sesión actualizada: ${hm(log.minutes)} → ${hm(r.minutes)}.` });
    } catch (e) {
      handleSessionFailure(log.id, e);
    } finally {
      setSessionBusyId(null);
    }
  }

  async function handleSessionDelete(log) {
    const subject = subjectById.get(log.subjectId);
    const ok = window.confirm(`¿Eliminar la sesión de ${hm(log.minutes)} de ${subject?.name ?? "esta asignatura"} (${formatMedium(log.date)})?`);
    if (!ok) return;
    setSessionBusyId(log.id);
    setListMsg(null);
    try {
      await onDeleteEntry(log.id);
      forgetSessionEdit(log.id);
      setListMsg({ type: "ok", text: `Sesión eliminada (−${hm(log.minutes)}).` });
    } catch (e) {
      handleSessionFailure(log.id, e);
    } finally {
      setSessionBusyId(null);
    }
  }

  function handleSessionFailure(id, e) {
    if (e && e.name === "EntryNotFoundError") {
      forgetSessionEdit(id);
      setListMsg({ type: "error", text: `${e.message} He actualizado la lista.` });
    } else {
      setSessionError(
        id,
        isNetworkError(e)
          ? `${friendlyError(e)}.`
          : `No se pudo guardar el cambio (${String((e && e.message) || e)}). Inténtalo de nuevo.`
      );
    }
  }

  // "Registros de hoy": un total por asignatura del día viewDate, cada uno
  // con las sesiones (entradas) que lo componen, de la más reciente a la más
  // antigua; los grupos, con la asignatura de la sesión más reciente arriba.
  const viewDayGroups = cursoSubjects
    .map((subject) => {
      const sessions = logs
        .filter((l) => l.date === viewDate && l.subjectId === subject.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      return { subject, sessions, total: sessions.reduce((acc, l) => acc + l.minutes, 0) };
    })
    .filter((g) => g.sessions.length > 0)
    .sort((a, b) => (a.sessions[0].createdAt < b.sessions[0].createdAt ? 1 : a.sessions[0].createdAt > b.sessions[0].createdAt ? -1 : 0));
  const viewDayTotal = viewDayGroups.reduce((acc, g) => acc + g.total, 0);
  const viewDayLabel = viewDate === todayIso ? "Registros de hoy" : `Registros del ${formatShort(viewDate)}`;

  // "Últimos registros": total por día y asignatura (como siempre).
  const historySubject = historySubjectId !== HISTORY_ALL ? cursoSubjects.find((s) => s.id === historySubjectId) : null;
  // En el histórico de todas las asignaturas, dentro de cada día va arriba la
  // asignatura con la sesión más reciente (los días ya bajan de más nuevo a más viejo).
  const history = historySubjectId === HISTORY_ALL
    ? (() => {
        const ultimaSesion = new Map();
        logs.forEach((l) => {
          const k = `${l.date}|${l.subjectId}`;
          if (!ultimaSesion.has(k) || l.createdAt > ultimaSesion.get(k)) ultimaSesion.set(k, l.createdAt);
        });
        return getAllEntriesFlat(cursoSubjects, entries, "desc").sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? 1 : -1;
          const ua = ultimaSesion.get(`${a.date}|${a.subjectId}`) || "";
          const ub = ultimaSesion.get(`${b.date}|${b.subjectId}`) || "";
          return ua < ub ? 1 : ua > ub ? -1 : 0;
        });
      })()
    : (historySubject ? getSubjectEntries(entries, historySubject.id, "desc") : []);

  function openDayInView(day, subjectId) {
    setViewDate(day);
    setExpandedSubjectId(subjectId);
    setListMsg(null);
    setListView("hoy");
  }

  return (
    <div className="grid-2">
      <div className="panel">
        <div className="panel-title">Registro de vuelo — {formatLong(date)}</div>
        <div className="field-row">
          <label className="field-label">Fecha</label>
          <input type="date" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} className="input-field" disabled={saving} />
        </div>
        {loggableSubjects.length === 0 ? (
          <div className="empty-hint">No hay asignaturas activas (todas están aprobadas o no has añadido ninguna todavía).</div>
        ) : (
          <>
            <div className="seg-control" style={{ marginBottom: 14 }}>
              <button className={`seg-btn ${mode === "manual" ? "seg-btn-active" : ""}`} onClick={() => setMode("manual")}>Manual</button>
              <button className={`seg-btn ${mode === "contador" ? "seg-btn-active" : ""}`} onClick={() => setMode("contador")}>Contador</button>
            </div>

            {mode === "contador" && (
              <div className="timer-box">
                <div className="gauge-sub" style={{ marginBottom: 8 }}>
                  Lo que mida el contador se añadirá al registro de {formatMedium(date)} al pulsar "Guardar registro" — cambia la fecha arriba si es para otro día.
                </div>
                <div className="field-row">
                  <label className="field-label">Asignatura</label>
                  <select
                    className="input-field"
                    value={timerSubjectId || ""}
                    onChange={(e) => setTimerSubjectId(e.target.value)}
                    disabled={timerRunning}
                  >
                    {/* Sin esta opción vacía, un <select> nativo sin ninguna opción
                        cuyo value coincida con "" (timerSubjectId a null) cae solo en
                        la primera asignatura de la lista — pareciendo seleccionada sin
                        estarlo de verdad, justo el hueco que puede acabar guardando el
                        contador en la asignatura equivocada. */}
                    {!timerSubjectId && <option value="">— Elige asignatura —</option>}
                    {loggableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="timer-display mono">{formatElapsed(timerElapsedMs)}</div>
                <div className="btn-row">
                  {!timerRunning ? (
                    <button className="btn-primary" onClick={startTimer} disabled={!timerSubjectId}>
                      {timerElapsedMs > 0 ? "Reanudar" : "Iniciar"}
                    </button>
                  ) : (
                    <button className="btn-ghost" onClick={pauseTimer}>Pausar</button>
                  )}
                  <button className="btn-primary" onClick={finishTimer} disabled={timerElapsedMs < 1000 || !timerSubjectId}>
                    Fin — meter en el registro
                  </button>
                  {timerElapsedMs >= 1000 && (
                    <button className="btn-ghost" onClick={resetTimer} title="Vuelve el contador a 00:00 sin meter nada en el registro">
                      Reiniciar
                    </button>
                  )}
                </div>
                {parseMinutes(values[timerSubjectId]).minutes > 0 && (
                  <div className="gauge-sub">
                    Hay {values[timerSubjectId]} min pendientes de guardar para esta asignatura — el contador se sumará a eso.
                  </div>
                )}
              </div>
            )}

            {mode === "manual" && (
              <div className="subject-inputs">
                <div className="gauge-sub" style={{ marginTop: 0, marginBottom: 8 }}>
                  Escribe los minutos que quieres AÑADIR; al guardar se suman a los registros de ese día.
                </div>
                {loggableSubjects.map((s) => (
                  <div className="field-row" key={s.id}>
                    <label className="field-label">
                      <span className="dot" style={{ background: s.color }} />
                      {s.name}
                    </label>
                    <div className="input-with-unit">
                      <input
                        type="number" min="0" max={MAX_MINUTES_PER_ENTRY} step="1" inputMode="numeric" placeholder="0"
                        value={values[s.id] || ""}
                        onChange={(e) => { setValues((v) => ({ ...v, [s.id]: e.target.value })); setFormMsg(null); }}
                        className="input-field input-num"
                        disabled={saving}
                      />
                      <span className="unit-tag">min</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="day-total-row">
              <span>Total a añadir</span>
              <span className="mono">{pendingTotal > 0 ? "+" : ""}{hm(pendingTotal)}</span>
            </div>
            <div className="btn-row">
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : "Guardar registro"}
              </button>
            </div>
            {formMsg && <div className={formMsg.type === "error" ? "auth-error" : "form-ok"}>{formMsg.text}</div>}
          </>
        )}
      </div>

      <div className="panel">
        <div className="seg-control" style={{ marginBottom: 14 }}>
          <button className={`seg-btn ${listView === "hoy" ? "seg-btn-active" : ""}`} onClick={() => setListView("hoy")}>{viewDayLabel}</button>
          <button className={`seg-btn ${listView === "ultimos" ? "seg-btn-active" : ""}`} onClick={() => setListView("ultimos")}>Últimos registros</button>
        </div>
        {listMsg && <div className={listMsg.type === "error" ? "auth-error" : "form-ok"}>{listMsg.text}</div>}

        {listView === "hoy" && (
          <>
            <div className="panel-title-row">
              <div className="panel-title" style={{ marginBottom: 0 }}>{formatLong(viewDate)}</div>
              {viewDate !== date && (
                <button className="btn-ghost btn-small" onClick={() => setViewDate(date)}>Volver a {formatShort(date)}</button>
              )}
            </div>
            {viewDayGroups.length === 0 && <div className="empty-hint">Todavía no hay registros este día.</div>}
            {viewDayGroups.length > 0 && (
              <>
                <div className="log-list">
                  {viewDayGroups.map(({ subject, sessions, total }) => {
                    const open = expandedSubjectId === subject.id;
                    return (
                      <div key={subject.id} className="day-group">
                        <button className="log-item" onClick={() => setExpandedSubjectId(open ? null : subject.id)} aria-expanded={open}>
                          <span className="log-caret">{open ? "▾" : "▸"}</span>
                          <span className="log-detail">
                            <span className="log-chip" style={{ borderColor: subject.color }}>{subject.name}</span>
                            <span className="gauge-sub" style={{ marginTop: 0 }}>{sessions.length} {sessions.length === 1 ? "sesión" : "sesiones"}</span>
                          </span>
                          <span className="log-total mono">{hm(total)}</span>
                        </button>
                        {open && (
                          <div className="session-list">
                            {sessions.map((l) => {
                              const edit = sessionEdits[l.id];
                              const changed = edit !== undefined && edit !== String(l.minutes);
                              const busy = sessionBusyId === l.id;
                              return (
                                <div key={l.id}>
                                  <div className="session-row">
                                    <span className="log-date" title={l.migrated ? "Registro anterior al cambio a sesiones" : undefined}>
                                      {l.migrated ? "previo" : formatTime(l.createdAt)}
                                    </span>
                                    <div className="input-with-unit">
                                      <input
                                        type="number" min="1" max={MAX_MINUTES_PER_ENTRY} step="1" inputMode="numeric"
                                        value={edit ?? String(l.minutes)}
                                        onChange={(e) => setSessionEdits((m) => ({ ...m, [l.id]: e.target.value }))}
                                        className="input-field input-num"
                                        disabled={busy}
                                        aria-label={`Minutos de la sesión de ${subject.name}`}
                                      />
                                      <span className="unit-tag">min</span>
                                    </div>
                                    <button className="btn-primary btn-small" onClick={() => handleSessionSave(l)} disabled={!changed || busy}>
                                      {busy ? "…" : "Guardar"}
                                    </button>
                                    <button className="btn-ghost btn-small" onClick={() => handleSessionDelete(l)} disabled={busy} title="Eliminar sesión" aria-label="Eliminar sesión">✕</button>
                                  </div>
                                  {sessionErrors[l.id] && <div className="auth-error">{sessionErrors[l.id]}</div>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="day-total-row">
                  <span>Total del día</span>
                  <span className="mono">{hm(viewDayTotal)}</span>
                </div>
              </>
            )}
          </>
        )}

        {listView === "ultimos" && (
          <>
            <div className="panel-title-row">
              <div className="panel-title" style={{ marginBottom: 0 }}>{historySubjectId === HISTORY_ALL ? "Últimos registros" : "Historial completo"}</div>
              <select className="input-field subject-select" value={historySubjectId} onChange={(e) => setHistorySubjectId(e.target.value)}>
                <option value={HISTORY_ALL}>Histórico (todas las asignaturas)</option>
                {cursoSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {history.length === 0 && <div className="empty-hint">Todavía no hay registros{historySubjectId === HISTORY_ALL ? " en este curso" : " para esta asignatura"}.</div>}
            {history.length > 0 && (
              <>
                <div className="log-list">
                  {history.slice(0, visibleCount).map((e) => (
                    <button
                      key={historySubjectId === HISTORY_ALL ? `${e.date}-${e.subjectId}` : e.date}
                      className="log-item"
                      onClick={() => openDayInView(e.date, historySubjectId === HISTORY_ALL ? e.subjectId : historySubjectId)}
                      title="Ver las sesiones de ese día"
                    >
                      <span className="log-date">{formatShort(e.date)}</span>
                      <span className="log-detail">
                        {historySubjectId === HISTORY_ALL ? (
                          <span className="log-chip" style={{ borderColor: e.subjectColor }}>{e.subjectName}</span>
                        ) : (
                          <span className="log-chip" style={{ borderColor: historySubject?.color }}>{formatMedium(e.date)}</span>
                        )}
                      </span>
                      <span className="log-total mono">{hm(e.minutes)}</span>
                    </button>
                  ))}
                </div>
                <div className="history-footer">
                  <span className="empty-hint" style={{ padding: "8px 0" }}>{history.length} registro(s) en total</span>
                  {visibleCount < history.length && (
                    <button className="btn-ghost btn-small" onClick={() => setVisibleCount((n) => n + 20)}>Cargar más</button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: PANEL (instrumentos)                                          */
/* ------------------------------------------------------------------ */

function PanelTab({ stats }) {
  const conRatio = stats.perSubject.filter((s) => !s.sinCreditos);
  const maxHoursPerCredit = Math.max(0.5, ...conRatio.map((s) => s.hoursPerCredit), ...conRatio.map((s) => s.target || 0)) * 1.15;
  const maxSessionSub = stats.perSubject.find((s) => s.id === stats.maxSession.subjectId) || null;

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Total registrado" value={hm(stats.globalTotal)} hint={`${stats.totalDaysLogged} días con estudio`} accent="var(--cyan-text)" />
        <StatCard label="Racha actual" value={`${stats.current} d`} hint={stats.current === 0 ? "sin actividad reciente" : "días seguidos"} accent={stats.current > 0 ? "#3DDC84" : "#8291AC"} />
        <StatCard label="Racha máxima" value={`${stats.longest} d`} hint="mejor marca del curso" accent="#F5A623" />
        <StatCard
          label="Sesión máxima"
          value={maxSessionSub ? hm(stats.maxSession.minutes) : "—"}
          hint={maxSessionSub ? `${maxSessionSub.name} · ${formatShort(stats.maxSession.date)}` : "sin datos"}
          accent="var(--purple)"
        />
        <StatCard
          label="Día con más minutos"
          value={stats.maxDayTotal.date ? hm(stats.maxDayTotal.minutes) : "—"}
          hint={stats.maxDayTotal.date ? formatShort(stats.maxDayTotal.date) : "sin datos"}
          accent="#3DDC84"
        />
        <StatCard
          label="Último registro"
          value={stats.lastActiveDate ? formatShort(stats.lastActiveDate) : "—"}
          hint={stats.daysSinceLast != null ? `hace ${stats.daysSinceLast} día(s)` : ""}
          accent={stats.daysSinceLast != null && stats.daysSinceLast > 5 ? "#FF5C5C" : "#8291AC"}
        />
      </div>

      <div className="panel">
        <div className="panel-title">Instrumentos de esfuerzo — horas por crédito</div>
        <div className="panel-subtitle">La marca vertical indica tu referencia (editable en Asignaturas). Compárala con cursos anteriores para saber si tienes que meterle caña.</div>
        {conRatio.map((s) => (
          <Gauge
            key={s.id}
            label={s.name}
            value={s.hoursPerCredit}
            max={maxHoursPerCredit}
            unit=" h/cr"
            target={s.target}
            color={s.color}
            sub={(() => {
              const base = `${s.pct.toFixed(1)} % del esfuerzo total · ${hm(s.total)} · ${s.daysActive} días activos${s.daysSince != null ? ` · última vez hace ${s.daysSince} d` : ""}`;
              if (s.target == null) return base;
              const faltan = s.target * s.credits * 60 - s.total;
              return (
                <>
                  {base}
                  <br />
                  <span style={{ color: faltan > 0 ? "var(--amber)" : "var(--green)" }}>
                    {faltan > 0 ? `Faltan ${hm(faltan)} para llegar a la referencia` : "Referencia alcanzada"}
                  </span>
                </>
              );
            })()}
          />
        ))}
      </div>

      <div className="panel">
        <div className="panel-title">Detalle por asignatura</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asignatura</th>
                <th>Estado</th>
                <th>Créditos</th>
                <th>Total</th>
                <th>% esfuerzo</th>
                <th>h / crédito</th>
                <th>Prom. día activo</th>
                <th>Sin estudiar</th>
              </tr>
            </thead>
            <tbody>
              {stats.perSubject.map((s) => (
                <tr key={s.id}>
                  <td><span className="dot" style={{ background: s.color }} />{s.name}</td>
                  <td><EstadoBadge estado={s.estado} /></td>
                  <td className="mono">{s.sinCreditos ? "—" : s.credits}</td>
                  <td className="mono">{hm(s.total)}</td>
                  <td className="mono">{s.pct.toFixed(1)}%</td>
                  <td className="mono">{s.sinCreditos ? "sin créditos" : s.hoursPerCredit.toFixed(2)}</td>
                  <td className="mono">{hm(s.avgActiveDay)}</td>
                  <td className="mono" style={{ color: s.daysSince > 7 ? "#FF5C5C" : s.daysSince > 3 ? "#F5A623" : "#8291AC" }}>
                    {s.daysSince != null ? `${s.daysSince} d` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ color, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="color-picker">
      <button
        type="button"
        className="color-swatch color-swatch-current"
        style={{ background: color }}
        aria-label="Cambiar color de la asignatura"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <span className="color-options" role="listbox" aria-label="Colores">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={c.toLowerCase() === (color || "").toLowerCase()}
              aria-label={c}
              className={`color-swatch ${c.toLowerCase() === (color || "").toLowerCase() ? "color-swatch-on" : ""}`}
              style={{ background: c }}
              onClick={() => { onChange(c); setOpen(false); }}
            />
          ))}
        </span>
      )}
    </span>
  );
}

// Los carteles de las gráficas se ajustan al ancho de la pantalla y parten el texto largo.
const TOOLTIP_STYLE = { background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, fontSize: 12, whiteSpace: "normal", overflowWrap: "anywhere", maxWidth: "min(260px, 70vw)" };
const TOOLTIP_WRAPPER = { maxWidth: "min(260px, 70vw)", zIndex: 5 };

function HoursPerCreditTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "#121A2B", border: "1px solid #26324A", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#E7ECF5", whiteSpace: "normal", overflowWrap: "anywhere", maxWidth: "min(260px, 70vw)" }}>
      <div style={{ marginBottom: 2 }}>{p.fullName}</div>
      <div className="mono">{p.horasPorCredito.toFixed(2)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: TRAYECTORIA (graficos)                                        */
/* ------------------------------------------------------------------ */

function TrayectoriaTab({ cursoSubjects, entries, stats, curso }) {
  const today = isoToday();
  const isTerminado = !!curso && curso.estado === "terminado";
  const cuatrimestreSplit = curso ? `${curso.endDate.slice(0, 4)}-02-01` : null;
  const [range, setRange] = useState(isTerminado ? "1c" : 90);
  const [trayView, setTrayView] = useState("acumulado");
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const toggleSubject = (id) => setHiddenIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const visibleSubjects = cursoSubjects.filter((s) => !hiddenIds.has(s.id));

  useEffect(() => {
    setRange(isTerminado ? "1c" : 90);
  }, [curso?.id, isTerminado]);

  const chartDates = useMemo(() => {
    const all = [...stats.activeDates].sort();
    if (all.length === 0) return [];
    if (isTerminado) {
      if (range === "all") return all;
      if (range === "1c") return all.filter((d) => d < cuatrimestreSplit);
      return all.filter((d) => d >= cuatrimestreSplit);
    }
    if (range === 0) return all;
    const from = addDays(today, -range);
    return all.filter((d) => d >= from);
  }, [stats.activeDates, range, isTerminado, cuatrimestreSplit, today]);

  const areaData = chartDates.map((d) => {
    const row = { date: formatShort(d) };
    visibleSubjects.forEach((s) => { row[s.name] = (entries[d] && entries[d][s.id]) || 0; });
    return row;
  });

  // Días naturales del curso hasta hoy (o hasta que terminó): incluye los
  // días sin estudio como ceros, para que tanto el acumulado como su
  // derivada respeten el tiempo real transcurrido — dos huecos de estudio
  // separados por semanas no deben quedar pegados uno al otro en el eje X.
  const gridEnd = curso.endDate < today ? curso.endDate : today;
  const allDays = [];
  for (let d = curso.startDate; d <= gridEnd; d = addDays(d, 1)) allDays.push(d);

  let acc = 0;
  const cumulativeData = allDays.map((d) => {
    const minutosDia = stats.dailyTotals[d] || 0;
    acc += minutosDia;
    return { date: formatShort(d), horas: +(acc / 60).toFixed(2), horasDia: +(minutosDia / 60).toFixed(2) };
  });

  const pieData = stats.perSubject.filter((s) => s.total > 0).map((s) => ({ name: s.name, value: s.total, color: s.color }));

  const barData = stats.perSubject.filter((s) => !s.sinCreditos).map((s) => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name,
    fullName: s.name,
    horasPorCredito: +s.hoursPerCredit.toFixed(2),
    color: s.color,
  }));

  return (
    <div>
      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title" style={{ marginBottom: 0 }}>Minutos diarios por asignatura</div>
          <div className="seg-control">
            {isTerminado ? (
              [
                { key: "1c", label: "1er cuatrimestre" },
                { key: "2c", label: "2º cuatrimestre" },
                { key: "all", label: "Todo el curso" },
              ].map((r) => (
                <button key={r.key} className={`seg-btn ${range === r.key ? "seg-btn-active" : ""}`} onClick={() => setRange(r.key)}>
                  {r.label}
                </button>
              ))
            ) : (
              [30, 90, 0].map((r) => (
                <button key={r} className={`seg-btn ${range === r ? "seg-btn-active" : ""}`} onClick={() => setRange(r)}>
                  {r === 0 ? "Todo el curso" : `${r} d`}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="tray-legend">
          {cursoSubjects.map((s) => {
            const hidden = hiddenIds.has(s.id);
            return (
              <div key={s.id} className={`tray-legend-item ${hidden ? "tray-legend-off" : ""}`}>
                <span className="dot" style={{ background: s.color }} />
                <span className="tray-legend-name">{s.name}</span>
                <button
                  type="button"
                  className="tray-legend-btn"
                  aria-pressed={!hidden}
                  onClick={() => toggleSubject(s.id)}
                >
                  {hidden ? "Mostrar" : "Ocultar"}
                </button>
              </div>
            );
          })}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={areaData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26324A" />
            <XAxis dataKey="date" stroke="#8291AC" fontSize={11} minTickGap={30} />
            <YAxis stroke="#8291AC" fontSize={11} />
            <Tooltip contentStyle={TOOLTIP_STYLE} wrapperStyle={TOOLTIP_WRAPPER} labelStyle={{ color: "#E7ECF5" }} />
            {visibleSubjects.map((s) => (
              <Area key={s.id} type="monotone" dataKey={s.name} stackId="1" stroke={s.color} fill={s.color} fillOpacity={0.55} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title-row">
            <div className="panel-title" style={{ marginBottom: 0 }}>
              {trayView === "acumulado" ? "Horas acumuladas en el curso" : "Ritmo diario (derivada)"}
            </div>
            <div className="seg-control">
              <button className={`seg-btn ${trayView === "acumulado" ? "seg-btn-active" : ""}`} onClick={() => setTrayView("acumulado")}>Acumulado</button>
              <button className={`seg-btn ${trayView === "derivada" ? "seg-btn-active" : ""}`} onClick={() => setTrayView("derivada")}>Derivada</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            {trayView === "acumulado" ? (
              <LineChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26324A" />
                <XAxis dataKey="date" stroke="#8291AC" fontSize={11} minTickGap={40} />
                <YAxis stroke="#8291AC" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP_STYLE} wrapperStyle={TOOLTIP_WRAPPER} labelStyle={{ color: "#E7ECF5" }} formatter={(v) => [`${v} h`, "Acumulado"]} />
                <Line type="monotone" dataKey="horas" stroke="#4FD8EA" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26324A" />
                <XAxis dataKey="date" stroke="#8291AC" fontSize={11} minTickGap={40} />
                <YAxis stroke="#8291AC" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP_STYLE} wrapperStyle={TOOLTIP_WRAPPER} labelStyle={{ color: "#E7ECF5" }} formatter={(v) => [`${v} h`, "Ese día"]} />
                <Bar dataKey="horasDia" fill="#F5A623" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-title">Distribución del esfuerzo</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} wrapperStyle={TOOLTIP_WRAPPER} labelStyle={{ color: "#E7ECF5" }} itemStyle={{ color: "#E7ECF5" }} formatter={(v) => hm(v)} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8291AC" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Horas por crédito — comparativa entre asignaturas</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26324A" />
            <XAxis dataKey="name" stroke="#8291AC" fontSize={11} />
            <YAxis stroke="#8291AC" fontSize={11} />
            <Tooltip content={<HoursPerCreditTooltip />} wrapperStyle={TOOLTIP_WRAPPER} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="horasPorCredito" radius={[4, 4, 0, 0]}>
              {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: ASIGNATURAS (gestion de cursos y asignaturas)                 */
/* ------------------------------------------------------------------ */

/* ---------- buscadores de universidad/carrera/asignatura canónica ---------- */
/* Se usan tanto aquí (alta de asignatura nueva) como en AuthGate.jsx
 * (completar perfil y pantalla de migración obligatoria): un input con
 * autocompletado difuso contra las filas canónicas y, si no aparece lo
 * que busca el usuario, un "no la encuentro" que la da de alta como
 * pendiente de aprobación y la deja usar de inmediato. */

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function CanonicalPickerBase({ placeholder, entityLabel, initialQuery, disabled, disabledHint, searchFn, renderResult, renderOption, onSelect, onCreatePendiente }) {
  const [query, setQuery] = useState(initialQuery || "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    if (disabled || !open) return;
    let cancelled = false;
    setLoading(true);
    searchFn(debouncedQuery)
      .then((rows) => { if (!cancelled) setResults(rows); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, disabled, open, searchFn]);

  function select(row) {
    setQuery(renderResult(row));
    setOpen(false);
    onSelect(row);
  }

  async function createPendiente() {
    const texto = query.trim();
    if (!texto) return;
    setLoading(true);
    try {
      await onCreatePendiente(texto);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  if (disabled) {
    return <input className="input-field" placeholder={disabledHint || placeholder} disabled />;
  }

  return (
    <div className="canonical-picker">
      <input
        className="input-field"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="canonical-picker-results">
          {loading && <div className="canonical-picker-hint">Buscando…</div>}
          {!loading && results.map((row) => (
            <button type="button" key={row.id} className="canonical-picker-option" onClick={() => select(row)}>
              {(renderOption || renderResult)(row)}
            </button>
          ))}
          {!loading && query.trim() && (
            <button type="button" className="canonical-picker-option canonical-picker-create" onClick={createPendiente}>
              Mi {entityLabel} no aparece aquí — introducirla manualmente: "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Indicador "Paso X de N" de las pantallas de registro. */
export function OnboardingStep({ step, total }) {
  return (
    <div className="ob-step mono" aria-label={`Paso ${step} de ${total}`}>
      <span>Paso {step} de {total}</span>
      <span className="ob-bar"><i style={{ width: `${(step / total) * 100}%` }} /></span>
    </div>
  );
}

/** Salida discreta de las pantallas de registro: pensada para quien se ha
 * equivocado de cuenta, no como atajo para saltarse el proceso. */
export function OnboardingSignOut({ email, onSignOut }) {
  return (
    <p className="ob-out">
      Sesión iniciada como {email} · ¿No eres tú?{" "}
      <button type="button" onClick={onSignOut}>Cerrar sesión</button>
    </p>
  );
}

export function CanonicalUniversidadPicker({ initialQuery, onSelect }) {
  return (
    <CanonicalPickerBase
      placeholder="Busca tu universidad"
      entityLabel="universidad"
      initialQuery={initialQuery}
      searchFn={(q) => searchUniversidades(q)}
      renderResult={(row) => row.nombre}
      onSelect={onSelect}
      onCreatePendiente={async (texto) => {
        const id = await createUniversidadPendiente(texto);
        onSelect({ id, nombre: texto, estado: "pendiente" });
      }}
    />
  );
}

export function CanonicalCarreraPicker({ universidadId, initialQuery, onSelect }) {
  return (
    <CanonicalPickerBase
      placeholder="Busca tu carrera"
      entityLabel="carrera"
      disabledHint="Elige primero tu universidad"
      disabled={!universidadId}
      initialQuery={initialQuery}
      searchFn={(q) => searchCarreras(universidadId, q)}
      renderResult={(row) => row.nombre}
      onSelect={onSelect}
      onCreatePendiente={async (texto) => {
        const id = await createCarreraPendiente(universidadId, texto);
        onSelect({ id, nombre: texto, estado: "pendiente" });
      }}
    />
  );
}

export function CanonicalAsignaturaPicker({ carreraId, initialQuery, onSelect }) {
  return (
    <CanonicalPickerBase
      placeholder="Busca tu asignatura"
      entityLabel="asignatura"
      disabledHint="Vincula primero tu carrera"
      disabled={!carreraId}
      initialQuery={initialQuery}
      searchFn={(q) => searchAsignaturasCanonicas(carreraId, q)}
      renderResult={(row) => row.nombre_oficial}
      renderOption={(row) => (
        <>
          {row.nombre_oficial}
          {row.creditos != null && <span className="canonical-picker-hint-inline"> — {row.creditos} créditos</span>}
          {row.anio != null && <span className="canonical-picker-hint-inline"> · {row.anio}º curso</span>}
        </>
      )}
      onSelect={onSelect}
      onCreatePendiente={async (texto) => {
        const id = await createAsignaturaPendiente(carreraId, texto, null);
        onSelect({ id, nombre_oficial: texto, creditos: null, estado: "pendiente" });
      }}
    />
  );
}

function ApprovalForm({ subject, subjects, onConfirm, onCancel }) {
  const [nota, setNota] = useState("");
  const [cursosNecesarios, setCursosNecesarios] = useState("1");
  const mergedSources = subjects.filter((s) => s.mergedInto === subject.id);
  const activeSources = mergedSources.filter((s) => s.estado === "aprobada");
  const pendingSources = mergedSources.filter((s) => s.estado !== "aprobada");
  const mergeTarget = subject.mergedInto ? subjects.find((s) => s.id === subject.mergedInto) : null;
  return (
    <div>
      <p className="panel-subtitle">
        Vas a marcar <strong>{subject.name}</strong> como aprobada. Nota y cursos necesarios quedan fijos para
        siempre; las horas/crédito, días totales y el desgaste se siguen recalculando siempre con los datos
        actuales, no se congelan.
      </p>
      {activeSources.length > 0 && (
        <p className="panel-subtitle">
          Ya suma las horas de: <strong>{activeSources.map((s) => s.name).join(", ")}</strong> (combinadas, ya aprobada).
        </p>
      )}
      {pendingSources.length > 0 && (
        <p className="panel-subtitle">
          Combinada también con <strong>{pendingSources.map((s) => s.name).join(", ")}</strong>, pero como
          {pendingSources.length === 1 ? " todavía no está aprobada" : " ninguna está aprobada todavía"}, sus horas
          no cuentan aún — se sumarán solas en cuanto la apruebes.
        </p>
      )}
      {mergeTarget && (
        <p className="panel-subtitle">
          Esta asignatura está combinada con <strong>{mergeTarget.name}</strong>: al aprobarla ahora, sus horas
          empezarán a sumarse también a la clasificación de {mergeTarget.name}.
        </p>
      )}
      <div className="field-row">
        <label className="field-label">Nota obtenida</label>
        <input type="number" step="0.1" className="input-field input-num" value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>
      <div className="field-row">
        <label className="field-label">Cursos necesarios</label>
        <input type="number" min="1" step="1" className="input-field input-num" value={cursosNecesarios} onChange={(e) => setCursosNecesarios(e.target.value)} />
      </div>
      <div className="btn-row">
        <button className="btn-primary" onClick={() => onConfirm({ nota, cursosNecesarios })}>Confirmar aprobación</button>
        <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function AsignaturasTab({ subjects, cursoSubjects, entries, profile, onAddSubject, onDeleteSubject, onUpdateSubject, onChangeEstado, onApprove, cursos, activeCursoId, onSelectCurso, onAddCurso, onRemoveCurso, onToggleCursoEstado }) {
  const carreraCanonicaId = profile?.carrera_canonica_id ?? null;
  const [newSubject, setNewSubject] = useState({ name: "", credits: "", asignaturaCanonicaId: null, esErasmus: false, resetKey: 0 });
  const [newCurso, setNewCurso] = useState({ name: "", startDate: "", endDate: "" });
  const [approvingId, setApprovingId] = useState(null);
  const [cursoToDeleteId, setCursoToDeleteId] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const cursoNameById = new Map(cursos.map((c) => [c.id, c.name]));
  // A qué curso "pertenece" cada asignatura para mostrarlo en "Combinar
  // con": igual que el resto de la app, por el rango de fechas de sus
  // registros, no por `originCursoId` (que solo es una pista de creación,
  // null en asignaturas migradas de cursos antiguos sin registro nuevo).
  const cursoIdBySubjectId = new Map();
  cursos.forEach((c) => {
    subjectsWithActivityInRange(subjects, entries, c.startDate, c.endDate).forEach((s) => {
      if (!cursoIdBySubjectId.has(s.id)) cursoIdBySubjectId.set(s.id, c.id);
    });
  });
  subjects.forEach((s) => {
    if (!cursoIdBySubjectId.has(s.id) && s.originCursoId) cursoIdBySubjectId.set(s.id, s.originCursoId);
  });

  function selectCanonicalAsignatura(row) {
    setNewSubject((v) => ({
      ...v,
      name: row.nombre_oficial,
      credits: row.creditos != null ? String(row.creditos) : v.credits,
      asignaturaCanonicaId: row.id,
    }));
  }

  function toggleErasmus(checked) {
    setNewSubject((v) => ({ ...v, esErasmus: checked, name: "", asignaturaCanonicaId: null, resetKey: v.resetKey + 1 }));
  }

  function addSubject() {
    if (!newSubject.name.trim() || !newSubject.credits) return;
    onAddSubject({
      name: newSubject.name.trim(),
      credits: parseFloat(newSubject.credits),
      asignaturaCanonicaId: newSubject.esErasmus ? null : newSubject.asignaturaCanonicaId,
      esErasmus: newSubject.esErasmus,
    });
    setNewSubject({ name: "", credits: "", asignaturaCanonicaId: null, esErasmus: false, resetKey: newSubject.resetKey + 1 });
  }

  function updateNewCursoName(name) {
    const inferred = inferCursoRange(name);
    setNewCurso((v) => ({
      ...v,
      name,
      startDate: inferred ? inferred.startDate : v.startDate,
      endDate: inferred ? inferred.endDate : v.endDate,
    }));
  }

  function addCurso() {
    if (!newCurso.name.trim() || !newCurso.startDate || !newCurso.endDate) return;
    onAddCurso(newCurso.name.trim(), newCurso.startDate, newCurso.endDate);
    setNewCurso({ name: "", startDate: "", endDate: "" });
  }

  const approvingSubject = approvingId ? subjects.find((s) => s.id === approvingId) : null;
  const hasEntries = (subjectId) => Object.values(entries).some((day) => day[subjectId] > 0);
  const curso = cursos.find((c) => c.id === activeCursoId);
  const cursoToDelete = cursoToDeleteId ? cursos.find((c) => c.id === cursoToDeleteId) : null;

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Cursos académicos</div>
        <div className="panel-subtitle">
          Cada curso es solo un rango de fechas — el registro de una asignatura se muestra bajo el curso al que
          corresponda su fecha, automáticamente, sin que tengas que vincular nada a mano.
        </div>
        <div className="curso-list">
          {cursos.map((c) => (
            <div key={c.id} className={`curso-chip ${c.id === activeCursoId ? "curso-chip-active" : ""}`}>
              <button onClick={() => onSelectCurso(c.id)} title={`${c.startDate} → ${c.endDate}`}>
                {c.name}
                {c.estado === "terminado" && <span className="curso-badge">terminado</span>}
              </button>
              {cursos.length > 1 && (
                <span className="curso-remove" onClick={() => setCursoToDeleteId(c.id)}>×</span>
              )}
            </div>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 12, alignItems: "center" }}>
          <input
            className="input-field"
            placeholder="Ej. 2026-2027"
            value={newCurso.name}
            onChange={(e) => updateNewCursoName(e.target.value)}
          />
          <input type="date" className="input-field" value={newCurso.startDate} onChange={(e) => setNewCurso((v) => ({ ...v, startDate: e.target.value }))} />
          <span className="gauge-sub" style={{ margin: 0 }}>→</span>
          <input type="date" className="input-field" value={newCurso.endDate} onChange={(e) => setNewCurso((v) => ({ ...v, endDate: e.target.value }))} />
          <button
            className="btn-primary"
            onClick={addCurso}
            disabled={!newCurso.name.trim() || !newCurso.startDate || !newCurso.endDate}
            style={!newCurso.name.trim() || !newCurso.startDate || !newCurso.endDate ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            Añadir curso
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title" style={{ marginBottom: 0 }}>Asignaturas de {curso?.name}</div>
          {curso && (
            <button className="btn-ghost btn-small" onClick={() => onToggleCursoEstado(curso.id)}>
              {curso.estado === "terminado" ? "Marcar como en curso" : "Marcar como terminado"}
            </button>
          )}
        </div>
        <div className="panel-subtitle">
          Si esta asignatura convalida o equivale a otra con nombre distinto que cursaste antes, puedes combinarla con
          ella desde "Combinar con". Sus horas, días y cursos necesarios se sumarán a la asignatura que finalmente apruebes.
          {curso?.estado === "terminado"
            ? " Este curso está marcado como terminado: en Trayectoria se muestra por cuatrimestres en vez de por días."
            : " Este curso está en marcha: en Trayectoria se muestra por los últimos 30/90 días."}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asignatura</th>
                <th>Estado</th>
                <th>Créditos</th>
                <th>Referencia h/crédito</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cursoSubjects.map((s) => {
                // "Combinar con" es un mecanismo personal (sumar tus horas de
                // una asignatura que repites en otro curso). No se filtra por
                // curso: a qué curso "pertenece" cada asignatura se infiere
                // por fecha de sus registros y no es fiable en todos los
                // casos (p. ej. una repetida sin apenas registros propios
                // todavía), así que solo se usa para la etiqueta informativa
                // del curso en cada opción, nunca para ocultarla.
                const mergeOptions = subjects.filter((o) => o.id !== s.id && !o.mergedInto);
                const hasOwnSources = subjects.some((o) => o.mergedInto === s.id);
                const deletable = !hasEntries(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <ColorPicker color={s.color} onChange={(c) => onUpdateSubject(s.id, { color: c })} />
                      <input
                        className="input-field input-inline"
                        value={s.name}
                        disabled={s.vinculadaValida}
                        title={s.vinculadaValida ? "Vinculada al catálogo — usa \"Cambiar\" para editarla" : undefined}
                        onChange={(e) => onUpdateSubject(s.id, { name: e.target.value })}
                      />
                      {s.vinculadaValida && reviewingId !== s.id && (
                        <div className="gauge-sub">
                          Vinculada al catálogo.{" "}
                          <button type="button" className="btn-ghost btn-small" onClick={() => setReviewingId(s.id)}>
                            Cambiar
                          </button>
                        </div>
                      )}
                      {!hasOwnSources && (
                        <select
                          className="input-field input-inline merge-select"
                          value={s.mergedInto || ""}
                          onChange={(e) => onUpdateSubject(s.id, { mergedInto: e.target.value || null })}
                        >
                          <option value="">No combinar (cuenta por separado)</option>
                          {mergeOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              Combinada con: {o.name} ({cursoNameById.get(cursoIdBySubjectId.get(o.id)) ?? "sin curso"})
                            </option>
                          ))}
                        </select>
                      )}
                      {hasOwnSources && (() => {
                        const sources = subjects.filter((o) => o.mergedInto === s.id);
                        const active = sources.filter((o) => o.estado === "aprobada");
                        const pending = sources.filter((o) => o.estado !== "aprobada");
                        return (
                          <div style={{ marginTop: 4 }}>
                            {active.length > 0 && (
                              <div className="gauge-sub">Combinada con: {active.map((o) => o.name).join(", ")}</div>
                            )}
                            {pending.length > 0 && (
                              <div className="gauge-sub" style={{ color: "var(--amber)" }}>
                                Combinada con (pendiente, no cuenta aún): {pending.map((o) => o.name).join(", ")}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {s.canonicalEstado === "rechazada" && reviewingId !== s.id && (
                        <div className="gauge-sub" style={{ color: "var(--red, #e5484d)" }}>
                          Rechazada al revisarla.{" "}
                          <button type="button" className="btn-ghost btn-small" onClick={() => setReviewingId(s.id)}>
                            Volver a buscar
                          </button>
                        </div>
                      )}
                      {reviewingId === s.id && (
                        <div style={{ marginTop: 4 }}>
                          <CanonicalAsignaturaPicker
                            carreraId={carreraCanonicaId}
                            onSelect={(row) => {
                              onUpdateSubject(s.id, { asignaturaCanonicaId: row.id, esErasmus: false });
                              setReviewingId(null);
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td>
                      <select
                        className="input-field input-inline estado-select"
                        value={s.estado}
                        onChange={(e) => {
                          if (e.target.value === "aprobada") setApprovingId(s.id);
                          else onChangeEstado(s.id, e.target.value);
                        }}
                      >
                        <option value="en_curso">En curso</option>
                        <option value="suspendida">Suspendida</option>
                        <option value="aprobada">Aprobada</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number" min="1" step="1" className="input-field input-inline input-num"
                        value={s.credits}
                        onChange={(e) => onUpdateSubject(s.id, { credits: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        type="number" min="0" step="0.1" className="input-field input-inline input-num"
                        placeholder="opcional"
                        value={s.target ?? ""}
                        onChange={(e) => onUpdateSubject(s.id, { target: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      />
                    </td>
                    <td>
                      <button
                        className="btn-ghost btn-small"
                        onClick={() => deletable && onDeleteSubject(s.id)}
                        disabled={!deletable}
                        title={deletable ? undefined : "No se puede eliminar: ya tiene registros guardados"}
                        style={!deletable ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="panel-subtitle" style={{ marginTop: 14 }}>
          {carreraCanonicaId
            ? "Busca la asignatura en el listado de tu carrera. Si no aparece, se guarda como pendiente de revisión y puedes usarla ya."
            : "Vincula tu universidad y carrera desde la pantalla de inicio para poder buscar asignaturas."}
        </div>
        <div className="btn-row" style={{ marginTop: 8, alignItems: "flex-start" }}>
          {newSubject.esErasmus ? (
            <input
              className="input-field"
              placeholder="Nombre de la asignatura (Erasmus)"
              value={newSubject.name}
              onChange={(e) => setNewSubject((v) => ({ ...v, name: e.target.value }))}
            />
          ) : (
            <CanonicalAsignaturaPicker key={newSubject.resetKey} carreraId={carreraCanonicaId} onSelect={selectCanonicalAsignatura} />
          )}
          <input
            className="input-field input-num" type="number" min="0" step="0.5" placeholder="Créditos"
            value={newSubject.credits}
            onChange={(e) => setNewSubject((v) => ({ ...v, credits: e.target.value }))}
          />
          <label className="report-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={newSubject.esErasmus} onChange={(e) => toggleErasmus(e.target.checked)} />
            ¿Es Erasmus?
          </label>
          <button className="btn-primary" onClick={addSubject} disabled={!newSubject.name.trim() || !newSubject.credits}>
            Añadir asignatura
          </button>
        </div>
      </div>

      {approvingSubject && (
        <Modal title="Marcar asignatura como aprobada" onClose={() => setApprovingId(null)}>
          <ApprovalForm
            subject={approvingSubject}
            subjects={subjects}
            onCancel={() => setApprovingId(null)}
            onConfirm={({ nota, cursosNecesarios }) => { onApprove(approvingSubject.id, { nota, cursosNecesarios }); setApprovingId(null); }}
          />
        </Modal>
      )}

      {cursoToDelete && (
        <Modal title="Eliminar curso" onClose={() => setCursoToDeleteId(null)}>
          <p>
            ¿Seguro que quieres eliminar <strong>{cursoToDelete.name}</strong>? Se borrarán todas las asignaturas
            y registros de estudio de este curso de forma permanente. Esta acción no se puede deshacer.
          </p>
          <div className="btn-row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
            <button className="btn-ghost" onClick={() => setCursoToDeleteId(null)}>Cancelar</button>
            <button
              className="btn-danger"
              onClick={() => { onRemoveCurso(cursoToDelete.id); setCursoToDeleteId(null); }}
            >
              Eliminar curso
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: DESGASTE (peor tramo, normalizado y personal)                 */
/* ------------------------------------------------------------------ */

const WEAR_FACTOR_INFO = {
  intensidad: {
    label: "Intensidad",
    explain: "Minutos de media que estudiaste cada día activo, durante el tramo más exigente de esta asignatura.",
    raw: (f) => `${f.intensidad.toFixed(0)} min/día`,
  },
  duracion: {
    label: "Duración",
    explain: "Cuántos días activos duró ese tramo — indica si fue un sprint corto o un esfuerzo sostenido en el tiempo.",
    raw: (f) => `${f.duracion} días`,
  },
  compresion: {
    label: "Compresión",
    explain: "Qué porcentaje de los días de ese tramo estudiaste sin fallar ninguno — cuanto más alto, menos respiro hubo.",
    raw: (f) => `${(f.compresion * 100).toFixed(0)}%`,
  },
  racha: {
    label: "Racha interna",
    explain: "El mayor número de días seguidos, sin ningún descanso, dentro de ese tramo.",
    raw: (f) => `${f.racha} días`,
  },
};

function DesgasteCard({ subject, desgaste, bare }) {
  const isEnCurso = subject.estado !== "aprobada";
  const wb = desgaste.worstBlock;
  return (
    <div className={bare ? "" : "panel wear-card"}>
      <div className="wear-card-head">
        <div>
          <span className="dot" style={{ background: subject.color }} />
          <strong>{subject.name}</strong>
          {isEnCurso && <span className="wear-provisional">vista previa, aún sin aprobar</span>}
        </div>
        <EstadoBadge estado={subject.estado} />
      </div>
      {!desgaste.comparable && (
        <div className="empty-hint">No comparable — datos insuficientes (ningún tramo de ≥3 días activos todavía).</div>
      )}
      {desgaste.comparable && (
        <>
          <div className="wear-index-row">
            <span className="wear-index-value">{desgaste.indice.toFixed(1)}</span>
            <div>
              <span className={`wear-label wear-label-${desgaste.etiqueta.toLowerCase()}`}>{desgaste.etiqueta}</span>
              {wb && (
                <div className="wear-index-sub">
                  Tu peor tramo fue del {formatShort(wb.first)} al {formatShort(wb.last)}: {wb.dias_activos} días
                  estudiando una media de {wb.intensidad.toFixed(0)} min/día.
                </div>
              )}
            </div>
          </div>
          <div className="wear-factors">
            {Object.entries(WEAR_FACTOR_INFO).map(([key, info]) => (
              <div className="wear-factor-card" key={key}>
                <div className="wear-factor-label">{info.label}</div>
                <div className="wear-factor-raw mono">{info.raw(desgaste.rawFactors)}</div>
                <div className="wear-factor-explain">{info.explain}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Para cada asignatura "oficial" (no fusionada dentro de otra), calcula el
 * desgaste de ella misma y el de cualquier asignatura combinada con
 * "Combinar con", y se queda con el mayor de los dos — p. ej. si Calcolo
 * Numerico está combinada con Métodos Matemáticos y su tramo fue más duro,
 * la clasificación general muestra el desgaste de Calcolo Numerico bajo
 * el nombre de Métodos Matemáticos. */
function buildDesgasteRanking(subjects, entries) {
  const targets = subjects.filter((s) => !s.mergedInto);
  return targets.map((target) => {
    const members = [target, ...subjects.filter((s) => s.mergedInto === target.id)];
    const computed = members.map((m) => ({ subject: m, desgaste: computeDesgaste(m.id, entries) }));
    const ranked = computed.filter((c) => c.desgaste.comparable);
    const best = ranked.length > 0 ? ranked.reduce((a, b) => (b.desgaste.indice > a.desgaste.indice ? b : a)) : null;
    return { target, best };
  }).sort((a, b) => {
    if (!a.best && !b.best) return a.target.name.localeCompare(b.target.name);
    if (!a.best) return 1;
    if (!b.best) return -1;
    return b.best.desgaste.indice - a.best.desgaste.indice;
  });
}

function DesgasteRankingTab({ subjects, entries }) {
  const [detailId, setDetailId] = useState(null);
  const groups = useMemo(() => buildDesgasteRanking(subjects, entries), [subjects, entries]);
  const detailGroup = detailId ? groups.find((g) => g.target.id === detailId) : null;

  return (
    <div>
      <div className="panel-subtitle" style={{ margin: "0 0 16px", padding: "0 4px" }}>
        Todas tus asignaturas, de la más a la menos dura. Si una asignatura está combinada con otra distinta
        ("Combinar con"), se muestra el mayor desgaste entre las dos — p. ej. si Calcolo Numerico (combinada con
        Métodos Matemáticos) tuvo el tramo más duro, es su número el que aparece aquí.
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Asignatura</th>
                <th>Estado</th>
                <th>Desgaste</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => (
                <tr key={g.target.id} className={g.best ? "clickable-row" : ""} onClick={() => g.best && setDetailId(g.target.id)}>
                  <td className="mono">{i + 1}</td>
                  <td>
                    <span className="dot" style={{ background: g.target.color }} />
                    {g.target.name}
                    {g.best && g.best.subject.id !== g.target.id && (
                      <div className="gauge-sub">Desgaste mostrado: {g.best.subject.name}</div>
                    )}
                  </td>
                  <td><EstadoBadge estado={g.target.estado} /></td>
                  <td>
                    {g.best ? (
                      <span className={`wear-label wear-label-${g.best.desgaste.etiqueta.toLowerCase()}`}>
                        {g.best.desgaste.indice.toFixed(1)} · {g.best.desgaste.etiqueta}
                      </span>
                    ) : (
                      <span className="mono" style={{ color: "var(--text-dim)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailGroup && detailGroup.best && (
        <Modal title={detailGroup.target.name} onClose={() => setDetailId(null)} wide>
          <DesgasteCard subject={detailGroup.best.subject} desgaste={detailGroup.best.desgaste} bare />
        </Modal>
      )}
    </div>
  );
}

function DesgasteTab({ cursoSubjects, subjects, entries }) {
  const [view, setView] = useState("curso");

  const rows = useMemo(() => {
    return cursoSubjects.map((s) => ({ subject: s, desgaste: computeDesgaste(s.id, entries) })).sort((a, b) => {
      const ai = a.desgaste.comparable ? a.desgaste.indice : -2;
      const bi = b.desgaste.comparable ? b.desgaste.indice : -2;
      if (a.subject.estado === "aprobada" && b.subject.estado !== "aprobada") return -1;
      if (b.subject.estado === "aprobada" && a.subject.estado !== "aprobada") return 1;
      return bi - ai;
    });
  }, [cursoSubjects, subjects, entries]);

  return (
    <div>
      <div className="seg-control" style={{ marginBottom: 16, display: "inline-flex" }}>
        <button className={`seg-btn ${view === "curso" ? "seg-btn-active" : ""}`} onClick={() => setView("curso")}>Por curso</button>
        <button className={`seg-btn ${view === "ranking" ? "seg-btn-active" : ""}`} onClick={() => setView("ranking")}>Clasificación de desgaste</button>
      </div>

      {view === "ranking" && <DesgasteRankingTab subjects={subjects} entries={entries} />}

      {view === "curso" && (
        rows.length === 0 ? (
          <div className="panel"><div className="empty-hint">Todavía no hay asignaturas en este curso.</div></div>
        ) : (
          <div>
            <div className="panel-subtitle" style={{ margin: "0 0 16px", padding: "0 4px" }}>
              Mide el tramo de estudio más exigente de cada asignatura de este curso, normalizado contra un tope fijo
              por factor (Intensidad 300 min/día, Duración 18 días, Compresión 90%, Racha interna 10 días), así que el
              índice de una asignatura no cambia según apruebes otras. Para las que siguen en curso se muestra además
              una vista previa de lo que saldría si las aprobaras hoy.
            </div>
            {rows.map(({ subject, desgaste }) => (
              <DesgasteCard key={subject.id} subject={subject} desgaste={desgaste} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB: CLASIFICACIÓN HISTÓRICA (tabla comparativa, sin normalizar)    */
/* ------------------------------------------------------------------ */

const CLASIF_COLUMNS = [
  { key: "name", label: "Asignatura" },
  { key: "horasPorCredito", label: "Horas/crédito" },
  { key: "horasTotales", label: "Horas totales" },
  { key: "cursosNecesarios", label: "Cursos necesarios" },
  { key: "nota", label: "Nota" },
];

// Cuántas filas entran en la tarjeta para compartir — no hace falta enseñar
// la clasificación entera, con el top se entiende perfectamente.
const SHARE_CARD_MAX_ROWS = 10;

const CLASIF_SHARE_FORMAT = {
  horasPorCredito: (r) => `${r.horasPorCredito.toFixed(2)} h/cr`,
  horasTotales: (r) => `${r.horasTotales.toFixed(1)} h`,
  cursosNecesarios: (r) => `${r.cursosNecesarios || 0} curso${r.cursosNecesarios === 1 ? "" : "s"}`,
  nota: (r) => (r.nota ? String(+r.nota.toFixed(1)) : "—"),
};

const CLASIF_SHARE_LABEL = {
  horasPorCredito: "horas por crédito",
  horasTotales: "horas totales",
  cursosNecesarios: "cursos necesarios",
  nota: "nota",
};

function ClasificacionDetail({ subject, subjects, entries }) {
  const f = subject.frozen;
  const c = computeClassification(subject, entries, subjects);
  const mergedSources = subjects.filter((s) => s.mergedInto === subject.id);
  const activeSources = mergedSources.filter((s) => s.estado === "aprobada");
  const pendingSources = mergedSources.filter((s) => s.estado !== "aprobada");

  const wearMembers = [subject, ...activeSources];
  const wearComputed = wearMembers.map((m) => ({ subject: m, desgaste: computeDesgaste(m.id, entries) }));
  const wearRanked = wearComputed.filter((w) => w.desgaste.comparable);
  const wearBest = wearRanked.length > 0
    ? wearRanked.reduce((a, b) => (b.desgaste.indice > a.desgaste.indice ? b : a))
    : wearComputed[0];
  const d = wearBest.desgaste;
  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <StatCard label="Horas / crédito" value={c.horasPorCredito.toFixed(2)} accent="var(--cyan-text)" />
        <StatCard label="Días totales" value={`${c.diasTotales} d`} accent="#F5A623" />
        <StatCard label="Cursos necesarios" value={f.cursosNecesarios ?? "—"} accent="var(--purple)" />
        <StatCard label="Nota" value={f.nota ?? "—"} accent="#3DDC84" />
      </div>
      {activeSources.length > 0 && (
        <div className="gauge-sub" style={{ padding: "0 4px 4px" }}>
          Combinada con: {activeSources.map((s) => s.name).join(", ")}
        </div>
      )}
      {pendingSources.length > 0 && (
        <div className="gauge-sub" style={{ padding: "0 4px 4px", color: "var(--amber)" }}>
          Pendiente de combinar (aún no aprobada, no cuenta todavía): {pendingSources.map((s) => s.name).join(", ")}
        </div>
      )}
      <div className="panel" style={{ marginTop: 4 }}>
        <div className="panel-title">Desgaste</div>
        {wearBest.subject.id !== subject.id && (
          <div className="gauge-sub" style={{ marginBottom: 6 }}>
            Desgaste mostrado: {wearBest.subject.name} (la que más costó)
          </div>
        )}
        {!d.comparable && <div className="empty-hint">No comparable — datos insuficientes.</div>}
        {d.comparable && (
          <>
            <div className="wear-index-row">
              <span className="wear-index-value">{d.indice.toFixed(1)}</span>
              <div>
                <span className={`wear-label wear-label-${d.etiqueta.toLowerCase()}`}>{d.etiqueta}</span>
              </div>
            </div>
            <div className="wear-factors">
              {Object.entries(WEAR_FACTOR_INFO).map(([key, info]) => (
                <div className="wear-factor-card" key={key}>
                  <div className="wear-factor-label">{info.label}</div>
                  <div className="wear-factor-raw mono">{info.raw(d.rawFactors)}</div>
                  <div className="wear-factor-explain">{info.explain}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="gauge-sub" style={{ padding: "0 4px" }}>
        Inicio: {c.fechaInicio ? formatMedium(c.fechaInicio) : "—"} · Aprobada: {formatMedium(f.fechaAprobacion)}
      </div>
    </div>
  );
}

/** El icono clásico de "compartir" (tres nodos unidos por dos líneas). */
function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L7.04 9.81C6.5 9.31 5.79 9 5 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
    </svg>
  );
}

/** Tarjeta autocontenida (ancho fijo, fondo propio) que se renderiza fuera
 * de la pantalla solo para capturarla como imagen — nunca la tabla real,
 * que es larga y se recorta al hacerle una foto. Muestra como mucho
 * SHARE_CARD_MAX_ROWS filas, con el valor de la columna por la que esté
 * ordenada la tabla en ese momento. */
function ClassificationShareCard({ ref, items, sortKey }) {
  const format = CLASIF_SHARE_FORMAT[sortKey] || CLASIF_SHARE_FORMAT.horasPorCredito;
  const label = CLASIF_SHARE_LABEL[sortKey] || CLASIF_SHARE_LABEL.horasPorCredito;
  return (
    <div ref={ref} className="share-card">
      <div className="share-card-header">
        <img src="/icon-192.png" alt="" width="30" height="30" className="share-card-logo" />
        <span className="share-card-brand">Clever</span>
      </div>
      <div className="share-card-title">Mi clasificación</div>
      <div className="share-card-subtitle">Top {items.length} · por {label}</div>
      <div className="share-card-list">
        {items.map((r, i) => (
          <div className="share-card-row" key={r.id}>
            <span className={`share-card-rank${i < 3 ? ` share-card-rank-${i + 1}` : ""}`}>{i + 1}</span>
            <span className="share-card-dot" style={{ background: r.color }} />
            <span className="share-card-name">{r.name}</span>
            <span className="share-card-value">{format(r)}</span>
          </div>
        ))}
      </div>
      <div className="share-card-footer">Bitácora de vuelo — Clever</div>
    </div>
  );
}

function ClasificacionTab({ subjects, entries }) {
  const [sortKey, setSortKey] = useState("horasPorCredito");
  const [sortDir, setSortDir] = useState("desc");
  const [detailId, setDetailId] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);
  const shareCardRef = useRef(null);

  const approved = subjects.filter((s) => s.estado === "aprobada" && s.frozen && !s.sinCreditos);

  const rows = useMemo(() => {
    const list = approved.map((s) => {
      const c = computeClassification(s, entries, subjects);
      return {
        id: s.id, name: s.name, color: s.color,
        horasPorCredito: c.horasPorCredito,
        horasTotales: +(c.minutosTotales / 60).toFixed(1),
        cursosNecesarios: s.frozen.cursosNecesarios ?? 0,
        nota: s.frozen.nota ?? 0,
      };
    });
    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [approved, entries, subjects, sortKey, sortDir]);

  function toggleSort(key) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const shareRows = useMemo(() => rows.slice(0, SHARE_CARD_MAX_ROWS), [rows]);

  async function handleShare() {
    if (sharing || !shareCardRef.current) return;
    setSharing(true);
    setShareError(null);
    try {
      const { shareNodeAsImage } = await import("./shareImage.js");
      await shareNodeAsImage(shareCardRef.current, {
        fileName: "clever-clasificacion.png",
        title: "Mi clasificación — Clever",
        text: `Así va mi clasificación histórica en Clever 📊\n${APP_SHARE_URL}`,
      });
    } catch (e) {
      // Si el usuario cancela la hoja de compartir nativa no es un error.
      if (!(e && e.name === "AbortError")) setShareError(String((e && e.message) || e));
    } finally {
      setSharing(false);
    }
  }

  const detailSubject = detailId ? subjects.find((s) => s.id === detailId) : null;

  if (approved.length === 0) {
    return <div className="panel"><div className="empty-hint">Todavía no hay asignaturas aprobadas. Márcalas como aprobadas desde la pestaña Asignaturas para verlas aquí.</div></div>;
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-title-row">
          <div className="panel-title" style={{ marginBottom: 0 }}>Clasificación histórica</div>
          <button
            type="button"
            className="btn-ghost btn-small share-btn"
            onClick={handleShare}
            disabled={sharing}
            title="Compartir tu clasificación como imagen"
          >
            <ShareIcon /> {sharing ? "Generando…" : "Compartir"}
          </button>
        </div>
        <div className="panel-subtitle">Cifras absolutas, sin normalizar — la forma más objetiva de comparar cuánto costó cada asignatura. Toca una fila para ver la ficha completa.</div>
        {shareError && <div className="auth-error" style={{ marginBottom: 10 }}>{shareError}</div>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {CLASIF_COLUMNS.map((c) => (
                  <th key={c.key} className="sortable-th" onClick={() => toggleSort(c.key)}>
                    {c.label}{sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clickable-row" onClick={() => setDetailId(r.id)}>
                  <td><span className="dot" style={{ background: r.color }} />{r.name}</td>
                  <td className="mono">{r.horasPorCredito.toFixed(2)}</td>
                  <td className="mono">{r.horasTotales.toFixed(1)}</td>
                  <td className="mono">{r.cursosNecesarios || "—"}</td>
                  <td className="mono">{r.nota || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fuera de la pantalla (nunca visible): solo existe para poder
          capturarla como imagen al pulsar "Compartir". Tamaño fijo y con
          su propio fondo, así la foto sale siempre completa y no como un
          recorte de la tabla real (que puede ser larga y muy ancha). */}
      <div className="share-card-offscreen" aria-hidden="true">
        <ClassificationShareCard ref={shareCardRef} items={shareRows} sortKey={sortKey} />
      </div>

      {detailSubject && (
        <Modal title={detailSubject.name} onClose={() => setDetailId(null)} wide>
          <ClasificacionDetail subject={detailSubject} subjects={subjects} entries={entries} />
        </Modal>
      )}
    </div>
  );
}

const DISABLE_CLOUD_SAVE = import.meta.env.VITE_DISABLE_CLOUD_SAVE === "true";

/* ------------------------------------------------------------------ */
/*  APP PRINCIPAL                                                      */
/* ------------------------------------------------------------------ */

function WelcomeCreateCurso({ onCreate, onSignOut, email }) {
  const [newCurso, setNewCurso] = useState({ name: "", startDate: "", endDate: "" });

  function updateName(name) {
    const inferred = inferCursoRange(name);
    setNewCurso((v) => ({
      ...v,
      name,
      startDate: inferred ? inferred.startDate : v.startDate,
      endDate: inferred ? inferred.endDate : v.endDate,
    }));
  }

  const canCreate = newCurso.name.trim() && newCurso.startDate && newCurso.endDate;

  return (
    <div className="app-shell app-loading">
      <style>{CSS}</style>
      <div className="panel auth-card">
        <OnboardingStep step={2} total={3} />
        <div className="panel-title">¡Bienvenido!</div>
        <div className="panel-subtitle">Antes de empezar, crea tu primer curso académico (solo un rango de fechas).</div>
        <div className="field-row">
          <label className="field-label">Nombre</label>
          <input className="input-field" placeholder="Ej. 2026-2027" value={newCurso.name} onChange={(e) => updateName(e.target.value)} />
        </div>
        <div className="field-row">
          <label className="field-label">Inicio</label>
          <input type="date" className="input-field" value={newCurso.startDate} onChange={(e) => setNewCurso((v) => ({ ...v, startDate: e.target.value }))} />
        </div>
        <div className="field-row">
          <label className="field-label">Fin</label>
          <input type="date" className="input-field" value={newCurso.endDate} onChange={(e) => setNewCurso((v) => ({ ...v, endDate: e.target.value }))} />
        </div>
        <div className="btn-row">
          <button
            className="btn-primary"
            disabled={!canCreate}
            onClick={() => onCreate(newCurso.name.trim(), newCurso.startDate, newCurso.endDate)}
          >
            Crear curso
          </button>
        </div>
        <OnboardingSignOut email={email} onSignOut={onSignOut} />
      </div>
    </div>
  );
}

/** Pantalla obligatoria para estudiantes nuevos: antes de entrar en la app
 * hay que dar de alta al menos una asignatura del curso que se acaba de
 * crear. Reutiliza el mismo buscador canónico que la pestaña Asignaturas.
 * No tiene botón para saltársela — "Continuar" solo se activa con ≥ 1
 * asignatura añadida. */
function SelectSubjectsGate({ curso, profile, subjects, cloudError, onAddSubject, onDeleteSubject, onContinue, onSignOut, email }) {
  const carreraCanonicaId = profile?.carrera_canonica_id ?? null;
  const [newSubject, setNewSubject] = useState({ name: "", credits: "", asignaturaCanonicaId: null, esErasmus: false, resetKey: 0 });
  const [adding, setAdding] = useState(false);

  function selectCanonicalAsignatura(row) {
    setNewSubject((v) => ({
      ...v,
      name: row.nombre_oficial,
      credits: row.creditos != null ? String(row.creditos) : v.credits,
      asignaturaCanonicaId: row.id,
    }));
  }

  function toggleErasmus(checked) {
    setNewSubject((v) => ({ ...v, esErasmus: checked, name: "", asignaturaCanonicaId: null, resetKey: v.resetKey + 1 }));
  }

  async function addSubject() {
    if (!newSubject.name.trim() || !newSubject.credits) return;
    setAdding(true);
    try {
      await onAddSubject({
        name: newSubject.name.trim(),
        credits: parseFloat(newSubject.credits),
        asignaturaCanonicaId: newSubject.esErasmus ? null : newSubject.asignaturaCanonicaId,
        esErasmus: newSubject.esErasmus,
      });
      setNewSubject({ name: "", credits: "", asignaturaCanonicaId: null, esErasmus: false, resetKey: newSubject.resetKey + 1 });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="app-shell app-loading">
      <style>{CSS}</style>
      <div className="panel auth-card" style={{ maxWidth: 560 }}>
        <OnboardingStep step={3} total={3} />
        <div className="panel-title">Añade tus asignaturas</div>
        <p className="panel-subtitle">
          Antes de empezar, añade al menos una asignatura de <strong>{curso.name}</strong> — puedes añadir el resto
          ahora o más adelante desde la pestaña Asignaturas.
        </p>

        {subjects.length > 0 && (
          <div className="field-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
            {subjects.map((s) => (
              <div key={s.id} className="norm-gate-row">
                <div className="norm-gate-label">
                  <span className="dot" style={{ background: s.color }} />
                  {s.name}
                </div>
                <button type="button" className="btn-ghost btn-small" onClick={() => onDeleteSubject(s.id)}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="panel-subtitle" style={{ marginTop: subjects.length > 0 ? 14 : 0 }}>
          {carreraCanonicaId
            ? "Busca la asignatura en el listado de tu carrera. Si no aparece, se guarda como pendiente de revisión y puedes usarla ya."
            : "Vincula tu universidad y carrera desde la pantalla de inicio para poder buscar asignaturas."}
        </div>
        <div className="btn-row" style={{ alignItems: "flex-start" }}>
          {newSubject.esErasmus ? (
            <input
              className="input-field"
              placeholder="Nombre de la asignatura (Erasmus)"
              value={newSubject.name}
              onChange={(e) => setNewSubject((v) => ({ ...v, name: e.target.value }))}
            />
          ) : (
            <CanonicalAsignaturaPicker key={newSubject.resetKey} carreraId={carreraCanonicaId} onSelect={selectCanonicalAsignatura} />
          )}
          <input
            className="input-field input-num" type="number" min="0" step="0.5" placeholder="Créditos"
            value={newSubject.credits}
            onChange={(e) => setNewSubject((v) => ({ ...v, credits: e.target.value }))}
          />
          <label className="report-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={newSubject.esErasmus} onChange={(e) => toggleErasmus(e.target.checked)} />
            ¿Es Erasmus?
          </label>
          <button className="btn-primary" onClick={addSubject} disabled={!newSubject.name.trim() || !newSubject.credits || adding}>
            {adding ? "…" : "Añadir asignatura"}
          </button>
        </div>
        {cloudError && <div className="auth-error">{cloudError}</div>}

        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="btn-primary" disabled={subjects.length === 0} onClick={onContinue}>
            Continuar {subjects.length === 0 && "(añade al menos 1 asignatura)"}
          </button>
        </div>
        <OnboardingSignOut email={email} onSignOut={onSignOut} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  REPORTAR UN PROBLEMA y NOVEDADES                                    */
/* ------------------------------------------------------------------ */

const SUPPORT_EMAIL = "cleverapp2026@gmail.com";

const TAB_LABELS = {
  bitacora: "Bitácora", rangos: "Rangos", panel: "Panel", trayectoria: "Trayectoria", desgaste: "Desgaste",
  clasificacion: "Clasificación", social: "Social", asignaturas: "Asignaturas",
};

/** Prepara un correo a SUPPORT_EMAIL con la descripción del usuario y,
 * si lo acepta, datos técnicos que ayudan a reproducir el fallo. Lo abre
 * siempre en Gmail (ventana de redactar de Gmail web, en otra pestaña), así
 * que no hace falta ningún servidor ni una app de correo configurada. */
function BugReportModal({ onClose, userId, tab }) {
  const [kind, setKind] = useState("Error");
  const [text, setText] = useState("");
  const [includeTech, setIncludeTech] = useState(true);
  const [copied, setCopied] = useState(false);

  const tech = [
    `Sección: ${TAB_LABELS[tab] || tab}`,
    `Fecha: ${new Date().toLocaleString("es-ES")}`,
    `Dirección: ${window.location.host}`,
    `Pantalla: ${window.innerWidth}×${window.innerHeight}`,
    `Navegador: ${navigator.userAgent}`,
    `ID de cuenta: ${userId}`,
  ].join("\n");
  const subject = `[Clever] ${kind}: ${text.trim().split("\n")[0].slice(0, 60) || "sin título"}`;
  const body = `${text.trim()}\n\n${includeTech ? `— Datos técnicos —\n${tech}\n` : ""}`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(`Para: ${SUPPORT_EMAIL}\nAsunto: ${subject}\n\n${body}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal title="🐞 Reportar un problema" onClose={onClose}>
      <p className="panel-subtitle">
        Cuéntanos qué ha pasado y qué esperabas que pasara. Se abrirá Gmail con el mensaje listo para
        enviar a <strong>{SUPPORT_EMAIL}</strong>.
      </p>
      <div className="seg-control" style={{ marginBottom: 12 }}>
        {["Error", "Sugerencia", "Otro"].map((k) => (
          <button key={k} className={`seg-btn ${kind === k ? "seg-btn-active" : ""}`} onClick={() => setKind(k)}>{k}</button>
        ))}
      </div>
      <textarea
        className="input-field report-textarea"
        rows={5}
        placeholder={kind === "Error" ? "Ej.: en la Bitácora, al pulsar Guardar con el contador en marcha, los minutos no se sumaron…" : "Escribe aquí tu mensaje…"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <label className="report-check">
        <input type="checkbox" checked={includeTech} onChange={(e) => setIncludeTech(e.target.checked)} />
        Incluir datos técnicos (sección, navegador, tamaño de pantalla e ID de cuenta) para localizar el fallo
      </label>
      <div className="btn-row">
        <a
          className={`btn-primary report-send ${text.trim() ? "" : "report-send-disabled"}`}
          href={text.trim() ? gmailUrl : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!text.trim()}
          onClick={(e) => { if (!text.trim()) e.preventDefault(); }}
        >
          Abrir en Gmail
        </a>
        <button className="btn-ghost" onClick={copyAll} disabled={!text.trim()}>{copied ? "✓ Copiado" : "Copiar mensaje"}</button>
      </div>
      <div className="gauge-sub">
        ¿No usas Gmail? Pulsa "Copiar mensaje" y pégalo en un correo nuevo a {SUPPORT_EMAIL} desde tu correo
        habitual (Outlook, iCloud…).
      </div>
    </Modal>
  );
}

// Novedades de esta actualización: se muestran en las primeras
// NEWS_MAX_SHOWS entradas a la app (por cuenta y dispositivo), salvo que
// el usuario marque "No volver a mostrar". Para anunciar otra novedad en
// el futuro basta con cambiar NEWS_VERSION y el contenido.
const NEWS_VERSION = "2026-10-social";
const NEWS_MAX_SHOWS = 3;
const newsCountedThisLoad = new Set(); // evita contar dos veces la misma carga

function newsKey(userId) {
  return `clever:novedades:${NEWS_VERSION}:${userId}`;
}
function readNewsState(userId) {
  try {
    return JSON.parse(localStorage.getItem(newsKey(userId))) || { shows: 0, dismissed: false };
  } catch {
    return { shows: 0, dismissed: false };
  }
}
function writeNewsState(userId, state) {
  try {
    localStorage.setItem(newsKey(userId), JSON.stringify(state));
  } catch {}
}

function NewsModal({ onClose, onReport, showDontShowAgain }) {
  const [dontShow, setDontShow] = useState(false);
  return (
    <Modal title="🚀 Novedades en Clever" onClose={() => onClose(dontShow)} wide>
      <div className="news">
        <section className="news-item">
          <div className="news-icon">👥</div>
          <div>
            <div className="news-title">Ya está aquí Social: Amigos</div>
            <ul className="news-list">
              <li>Elige tu <strong>nombre de usuario</strong>, añade amigos con la lupa y mira la <strong>clasificación</strong> de rangos y rachas entre vosotros.</li>
              <li>Toca a un amigo para ver su <strong>ficha</strong>: rango, racha, métricas y mapa de calor — en modo solo lectura, y solo si los dos habéis aceptado compartir.</li>
              <li>¿Un amigo aún no tiene Clever? Con el botón de <strong>invitar</strong> le mandas un enlace.</li>
              <li>Las estadísticas de la comunidad por asignatura llegarán pronto.</li>
            </ul>
          </div>
        </section>
        <section className="news-item">
          <div className="news-icon">🧭</div>
          <div>
            <div className="news-title">Nuevo orden y navegación móvil</div>
            <ul className="news-list">
              <li>Las secciones van ahora en este orden: <strong>Bitácora, Trayectoria, Panel, Rangos, Desgaste, Clasificación, Social y Asignaturas</strong>.</li>
              <li>En el móvil hay una <strong>barra inferior</strong> con Bitácora, Trayectoria, Panel, Social y <strong>Más</strong> (Rangos, Desgaste y Clasificación están dentro de Más); el menú de cuenta ahora está en el círculo con tu inicial.</li>
              <li>Nueva sección <strong>Social</strong>: compara tus estadísticas con las de tus amigos.</li>
              <li>Los registros ahora salen de <strong>más reciente a más antiguo</strong>.</li>
            </ul>
          </div>
        </section>
        <section className="news-item">
          <div className="news-icon">🎉</div>
          <div>
            <div className="news-title">Ya eres un usuario Premium</div>
            <ul className="news-list">
              <li>Por haberte unido a Clever este curso <strong>2026-2027</strong>, tienes el plan <strong>Premium activado gratis</strong> — no tienes que hacer nada ni pagar nada.</li>
              <li><strong>Clasificación histórica:</strong> compara el esfuerzo (horas por crédito) entre todas tus asignaturas aprobadas, y comparte tu top con una foto.</li>
              <li><strong>Exportar a Excel:</strong> descarga el registro diario, el resumen y las gráficas de tu curso en un .xlsx.</li>
              <li>Te hemos mandado también un correo confirmándolo — si no lo ves, revisa spam.</li>
            </ul>
          </div>
        </section>
        <section className="news-item">
          <div className="news-icon">🛫</div>
          <div>
            <div className="news-title">Nueva pestaña: Rangos</div>
            <ul className="news-list">
              <li>Ya puedes ver tu <strong>rango de la season</strong> según tus puntos, tu <strong>racha</strong> de días seguidos estudiando y el <strong>historial</strong> de temporadas pasadas.</li>
              <li>Las seasons duran un cuatrimestre cada una: <strong>Season 1</strong> de septiembre a febrero y <strong>Season 2</strong> de febrero a julio — son las mismas fechas para todo el mundo, como en un videojuego.</li>
              <li>Al terminar una season, su rango final queda guardado para siempre en el Historial y el rango vuelve a cero para la nueva.</li>
            </ul>
          </div>
        </section>
        <section className="news-item">
          <div className="news-icon">🐞</div>
          <div>
            <div className="news-title">¿Algo no funciona? Cuéntanoslo</div>
            <p className="news-text">
              Desde el menú de tu cuenta (el círculo de arriba a la derecha) → <strong>Reportar un problema</strong> puedes enviarnos errores o sugerencias en un momento, o escribirnos
              directamente a <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}`} target="_blank" rel="noopener noreferrer">{SUPPORT_EMAIL}</a>.
            </p>
            <button className="btn-ghost btn-small" onClick={onReport}>Reportar un problema</button>
          </div>
        </section>
      </div>
      <div className="news-footer">
        {showDontShowAgain ? (
          <label className="report-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
            No volver a mostrar
          </label>
        ) : <span />}
        <button className="btn-primary" onClick={() => onClose(dontShow)}>¡Entendido!</button>
      </div>
    </Modal>
  );
}

export default function App({ session, profile, onSignOut, onDeleteAccount } = {}) {
  useEffect(() => {
    // Precarga (ociosa) de las imágenes de Rangos para que la pestaña abra al instante.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
    idle(() => prefetchRangosImages());
  }, []);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("bitacora");
  const [cloudError, setCloudError] = useState(null);
  // Empieza en false en cada entrada nueva a la app (recarga, login, volver
  // a abrir la pestaña...): si en ese momento la cuenta no tiene ninguna
  // asignatura —sea porque acaba de registrarse o porque las ha ido
  // borrando todas en algún momento— se la obliga a dar de alta al menos
  // una antes de continuar. Una vez confirmado no vuelve a saltar dentro
  // de la misma sesión aunque borre esa asignatura después.
  const [subjectGateConfirmed, setSubjectGateConfirmed] = useState(false);
  // Una vez mostrada la pantalla de añadir asignaturas, se mantiene abierta hasta pulsar
  // "Continuar": si no, desaparecería al añadir la primera y no se podrían añadir más.
  const [subjectGateOpen, setSubjectGateOpen] = useState(false);
  useEffect(() => {
    if (data && data.subjects.length === 0 && !subjectGateConfirmed) setSubjectGateOpen(true);
  }, [data, subjectGateConfirmed]);
  const [theme, setTheme] = useState(
    () => (typeof window !== "undefined" && window.localStorage.getItem("clever_theme")) || "dark"
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem("clever_theme", theme);
    } catch {
      // Modo privado / almacenamiento bloqueado: el tema simplemente no
      // se recuerda entre sesiones, pero sigue funcionando en esta.
    }
  }, [theme]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState(null);
  const supportsPasskey = typeof window !== "undefined" && !!window.PublicKeyCredential;
  const userId = session.user.id;

  // Menú de cuenta (el círculo de perfil de la cabecera): agrupa huella, exportar,
  // tema, cerrar sesión y eliminar cuenta en un desplegable, para no
  // llenar la cabecera de botones sueltos. Se cierra solo al tocar fuera.
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // null = cerrado; "auto" = abierto solo al entrar; "manual" = desde el menú
  const [newsOpen, setNewsOpen] = useState(null);
  const isMobile = useIsMobile();
  const [moreOpen, setMoreOpen] = useState(false);
  // Invitación recibida por enlace (?invitar=usuario): lleva directo a Social.
  const [pendingInvite, setPendingInvite] = useState(() => readPendingInvite());
  const [socialSettingsOpen, setSocialSettingsOpen] = useState(false);
  // Foto para el botón de cuenta: la subida por el usuario y, si no, la de Google.
  const googleAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
  const googlePhoto = googleAvatar && GOOGLE_AVATAR_RE.test(googleAvatar) ? googleAvatar : null;
  const [socialPhoto, setSocialPhoto] = useState(null);
  const headerPhoto = socialPhoto || googlePhoto;
  const refreshSocialPhoto = useCallback(async () => {
    try {
      const pf = await getMiPerfilSocial(session.user.id);
      setSocialPhoto(pf?.avatar_path ? photoUrl(pf.avatar_path) : null);
    } catch { /* sin conexión: se queda la de Google o la inicial */ }
  }, [session.user.id]);
  useEffect(() => { refreshSocialPhoto(); }, [refreshSocialPhoto]);
  const [socialKey, setSocialKey] = useState(0); // al cerrar los ajustes se recarga la pestaña Social
  useEffect(() => { if (pendingInvite) setTab("social"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [newsSeen, setNewsSeen] = useState(() => Boolean(readNewsState(session.user.id).seen));

  useEffect(() => {
    const userIdForNews = session.user.id;
    if (newsCountedThisLoad.has(userIdForNews)) return;
    newsCountedThisLoad.add(userIdForNews);
    const state = readNewsState(userIdForNews);
    if (state.dismissed || state.shows >= NEWS_MAX_SHOWS) return;
    writeNewsState(userIdForNews, { ...state, shows: state.shows + 1 });
    setNewsOpen("auto");
  }, [session.user.id]);

  function closeNews(dontShowAgain) {
    writeNewsState(session.user.id, { ...readNewsState(session.user.id), seen: true, ...(dontShowAgain ? { dismissed: true } : {}) });
    setNewsSeen(true);
    setNewsOpen(null);
  }
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountErr, setDeleteAccountErr] = useState(null);

  async function handleDeleteAccount() {
    if (deleteConfirmText.trim().toUpperCase() !== "ELIMINAR") return;
    setDeletingAccount(true);
    setDeleteAccountErr(null);
    try {
      await onDeleteAccount();
    } catch (e) {
      setDeleteAccountErr(String((e && e.message) || e));
      setDeletingAccount(false);
    }
  }
  const passkeyStorageKey = `clever_passkey_registered:${userId}`;
  // La API de Supabase no expone "¿este dispositivo ya tiene una passkey?",
  // así que lo recordamos localmente — es información inherentemente por
  // dispositivo (la clave privada vive en el propio móvil/portátil).
  const [passkeyRegistered, setPasskeyRegistered] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(passkeyStorageKey) === "1"
  );

  async function registerPasskey() {
    setPasskeyBusy(true);
    setPasskeyMsg(null);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      window.localStorage.setItem(passkeyStorageKey, "1");
      setPasskeyRegistered(true);
      setPasskeyMsg("Huella activada en este dispositivo.");
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (/previously registered/i.test(msg)) {
        // Este dispositivo ya tenía una passkey de antes de que guardáramos
        // el estado localmente — no es un fallo real, solo falta recordarlo.
        window.localStorage.setItem(passkeyStorageKey, "1");
        setPasskeyRegistered(true);
        setPasskeyMsg("Ya tenías la huella activada en este dispositivo.");
      } else {
        setPasskeyMsg(`Error: ${msg}`);
      }
    } finally {
      setPasskeyBusy(false);
    }
  }
  // Plan free: registro y cálculos del curso actual igual que todos, pero
  // sin histórico multi-año ni comparación (Clasificación) — los datos
  // siguen guardándose sin restricción, solo se oculta en la interfaz.
  const isPremium = profile.plan !== "free";

  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState(null);

  async function handleExportExcel() {
    if (!isPremium || exportBusy || !data || !curso) return;
    setExportBusy(true);
    setExportError(null);
    try {
      const { exportSubjectsToExcel } = await import("./exportExcel.js");
      await exportSubjectsToExcel(data, curso);
    } catch (e) {
      setExportError(String((e && e.message) || e));
    } finally {
      setExportBusy(false);
    }
  }

  const deviceId = useMemo(() => getDeviceId(), []);
  const loadSeqRef = useRef(0);
  const lastLoadAtRef = useRef(0);

  // Trae de Supabase el estado actual (lo guardado desde cualquier
  // dispositivo). Si hay varias cargas en vuelo, solo se aplica la última
  // que se empezó, para que una respuesta antigua no pise a una más nueva.
  // Mantiene el curso que estuviera seleccionado. No toca el formulario de
  // la Bitácora (lo escrito sin guardar vive allí, no en `data`).
  async function refreshData() {
    const seq = ++loadSeqRef.current;
    lastLoadAtRef.current = Date.now();
    try {
      const fresh = await loadUserData(userId);
      if (seq !== loadSeqRef.current) return;
      setData((prev) =>
        prev && fresh.cursos.some((c) => c.id === prev.activeCursoId) ? { ...fresh, activeCursoId: prev.activeCursoId } : fresh
      );
      setCloudError(null);
    } catch (e) {
      if (seq === loadSeqRef.current) setCloudError(friendlyError(e));
    }
  }

  useEffect(() => {
    refreshData();
    // Al volver a la pestaña/app (p. ej. tras guardar desde el móvil), se
    // recargan los datos. "focus" cubre el caso de PC en que la ventana
    // nunca llegó a ocultarse; el margen de 2 s evita cargar dos veces
    // cuando saltan los dos eventos a la vez.
    function onReturn() {
      if (DISABLE_CLOUD_SAVE || document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadAtRef.current < 2000) return;
      refreshData();
    }
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    // Al recuperar la conexión se recarga (limpia también el aviso de "sin conexión").
    function onOnline() {
      if (!DISABLE_CLOUD_SAVE) refreshData();
    }
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [userId]);

  // Cada acción del usuario (guardar un día, añadir una asignatura, etc.)
  // escribe directamente en Supabase en el momento — ya no hay un guardado
  // automático de "todo el bloque" cada pocos segundos como con Google
  // Sheets. Si DISABLE_CLOUD_SAVE está activo (solo en local, para pruebas),
  // se salta la escritura real y solo se actualiza la vista.
  async function withCloudWrite(fn) {
    if (DISABLE_CLOUD_SAVE) return;
    try {
      await fn();
      setCloudError(null);
    } catch (e) {
      setCloudError(friendlyError(e));
    }
  }

  const curso = useMemo(() => data && data.cursos.find((c) => c.id === data.activeCursoId), [data]);
  const cursoEntries = useMemo(
    () => (data && curso ? entriesInRange(data.entries, curso.startDate, curso.endDate) : {}),
    [data, curso]
  );
  const cursoSubjects = useMemo(
    () => (data && curso ? subjectsWithActivityInRange(data.subjects, data.entries, curso.startDate, curso.endDate) : []),
    [data, curso]
  );
  const cursoSubjectsForManagement = useMemo(
    () => (data && curso ? subjectsForRegisterInCurso(data.subjects, data.entries, curso) : []),
    [data, curso]
  );
  const loggableSubjects = useMemo(
    () => cursoSubjectsForManagement.filter((s) => s.estado !== "aprobada"),
    [cursoSubjectsForManagement]
  );
  const cursoLogs = useMemo(
    () => (data && curso ? data.logs.filter((l) => l.date >= curso.startDate && l.date <= curso.endDate) : []),
    [data, curso]
  );
  const stats = useMemo(
    () => (data && curso ? computeStats(cursoSubjects, cursoEntries, cursoLogs) : null),
    [data, curso, cursoSubjects, cursoEntries, cursoLogs]
  );

  // Aplica un cambio a la lista de entradas y recalcula a partir de ella
  // los totales por día/asignatura (entries) que usan las estadísticas.
  function applyLogs(updater) {
    setData((d) => {
      const logs = updater(d.logs);
      return { ...d, logs, entries: buildEntriesFromLogs(logs) };
    });
  }

  // Las acciones de entradas esperan a que Supabase confirme ANTES de tocar
  // la vista: si falla, lanzan el error y la Bitácora conserva lo escrito y
  // lo muestra. Tras confirmar, se recarga todo para ver también lo que se
  // haya guardado desde otros dispositivos.
  async function handleSaveEntries(newLogs) {
    if (!DISABLE_CLOUD_SAVE) await insertEntries(userId, newLogs, deviceId);
    const createdAt = new Date().toISOString();
    const ids = new Set(newLogs.map((l) => l.id));
    applyLogs((logs) => [
      ...logs.filter((l) => !ids.has(l.id)),
      ...newLogs.map((l) => ({ ...l, createdAt, deviceId, migrated: false })),
    ]);
    if (!DISABLE_CLOUD_SAVE) refreshData();
  }

  async function runEntryWrite(write, updater) {
    try {
      if (!DISABLE_CLOUD_SAVE) await write();
    } catch (e) {
      // Otro dispositivo ya la había borrado: se recarga para mostrar la realidad.
      if (e instanceof EntryNotFoundError) refreshData();
      throw e;
    }
    applyLogs(updater);
    if (!DISABLE_CLOUD_SAVE) refreshData();
  }

  function handleUpdateEntry(entryId, minutes) {
    return runEntryWrite(
      () => updateEntryMinutes(userId, entryId, minutes),
      (logs) => logs.map((l) => (l.id === entryId ? { ...l, minutes } : l))
    );
  }

  function handleDeleteEntry(entryId) {
    return runEntryWrite(() => deleteEntry(userId, entryId), (logs) => logs.filter((l) => l.id !== entryId));
  }

  // Añadir asignatura/curso necesita el id real que genera Supabase antes
  // de poder guardarlo en el estado local (los registros de estudio se
  // referencian a ese id), así que aquí sí se espera a la respuesta del
  // servidor en vez de actualizar la vista primero.
  async function handleAddSubject({ name, credits, asignaturaCanonicaId = null, esErasmus = false }) {
    const color = PALETTE[(data?.subjects.length || 0) % PALETTE.length];
    const originCursoId = curso?.id ?? null;
    if (DISABLE_CLOUD_SAVE) {
      const newSub = {
        id: uid("sub"), name, credits, target: null, color,
        estado: "en_curso", mergedInto: null, originCursoId, frozen: null,
        asignaturaCanonicaId, esErasmus, canonicalEstado: null,
      };
      setData((d) => ({ ...d, subjects: [...d.subjects, newSub] }));
      return;
    }
    try {
      const newSub = await insertSubject(userId, { name, credits, color, originCursoId, asignaturaCanonicaId, esErasmus });
      setData((d) => ({ ...d, subjects: [...d.subjects, newSub] }));
      setCloudError(null);
    } catch (e) {
      setCloudError(friendlyError(e));
    }
  }

  function handleDeleteSubject(subjectId) {
    const hasEntries = Object.values(data.entries).some((day) => day[subjectId] > 0);
    if (hasEntries) return;
    setData((d) => ({ ...d, subjects: d.subjects.filter((s) => s.id !== subjectId) }));
    withCloudWrite(() => deleteSubject(userId, subjectId));
  }

  function handleUpdateSubject(subjectId, patch) {
    setData((d) => ({ ...d, subjects: d.subjects.map((s) => (s.id === subjectId ? { ...s, ...patch } : s)) }));
    withCloudWrite(() => updateSubject(userId, subjectId, patch));
  }

  function handleChangeEstado(subjectId, estado) {
    setData((d) => ({
      ...d,
      subjects: d.subjects.map((s) => (s.id === subjectId ? { ...s, estado, frozen: estado === "aprobada" ? s.frozen : null } : s)),
    }));
    withCloudWrite(() => updateSubjectEstado(userId, subjectId, estado));
  }

  function handleApprove(subjectId, { nota, cursosNecesarios }) {
    const subject = data.subjects.find((s) => s.id === subjectId);
    const approved = freezeApproval(subject, { nota, cursosNecesarios });
    setData((d) => ({ ...d, subjects: d.subjects.map((s) => (s.id === subjectId ? approved : s)) }));
    withCloudWrite(() => approveSubject(userId, subjectId, approved.frozen));
  }

  async function handleAddCurso(name, startDate, endDate) {
    if (DISABLE_CLOUD_SAVE) {
      const id = uid("curso");
      setData((d) => ({ ...d, activeCursoId: id, cursos: [...d.cursos, { id, name, startDate, endDate, estado: "en_curso" }] }));
      return;
    }
    try {
      const newCurso = await insertCurso(userId, { name, startDate, endDate });
      setData((d) => ({ ...d, activeCursoId: newCurso.id, cursos: [...d.cursos, newCurso] }));
      setCloudError(null);
    } catch (e) {
      setCloudError(friendlyError(e));
    }
  }

  function handleToggleCursoEstado(id) {
    const target = data.cursos.find((c) => c.id === id);
    const nextEstado = target?.estado === "terminado" ? "en_curso" : "terminado";
    setData((d) => ({ ...d, cursos: d.cursos.map((c) => (c.id === id ? { ...c, estado: nextEstado } : c)) }));
    withCloudWrite(() => updateCursoEstado(userId, id, nextEstado));
  }

  function handleRemoveCurso(id) {
    if (data.cursos.length === 1) return;
    setData((d) => {
      if (d.cursos.length === 1) return d;
      const cursos = d.cursos.filter((c) => c.id !== id);
      return { ...d, activeCursoId: d.activeCursoId === id ? cursos[0].id : d.activeCursoId, cursos };
    });
    withCloudWrite(() => deleteCurso(userId, id));
  }

  if (data && data.cursos.length === 0) {
    return <WelcomeCreateCurso onCreate={handleAddCurso} onSignOut={onSignOut} email={session.user.email} />;
  }

  if (!data && cloudError) {
    // La primera carga falló: en vez de "Cargando…" para siempre, se avisa
    // (con mensaje propio si es por falta de conexión) y se deja reintentar.
    const offline = cloudError === OFFLINE_MESSAGE;
    return (
      <div className="app-shell app-loading">
        <style>{CSS}</style>
        <div className="panel auth-card">
          <div className="panel-title">{offline ? "Sin conexión" : "No se pudieron cargar tus datos"}</div>
          <div className="auth-error">{cloudError}</div>
          <div className="btn-row">
            <button className="btn-primary" onClick={() => { setCloudError(null); refreshData(); }}>Reintentar</button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !curso || !stats) {
    return (
      <div className="app-shell app-loading">
        <style>{CSS}</style>
        <div className="mono" style={{ color: "#8291AC" }}>Cargando bitácora…</div>
      </div>
    );
  }

  if ((data.subjects.length === 0 || subjectGateOpen) && !subjectGateConfirmed) {
    return (
      <SelectSubjectsGate
        curso={curso}
        profile={profile}
        subjects={data.subjects}
        cloudError={cloudError}
        onAddSubject={handleAddSubject}
        onDeleteSubject={handleDeleteSubject}
        onContinue={() => setSubjectGateConfirmed(true)}
        onSignOut={onSignOut}
        email={session.user.email}
      />
    );
  }

  return (
    <div className="app-shell">
      <style>{CSS}</style>
      <header className="app-header">
        <div className="brand">
          <img className="brand-logo" src="/icon-192.png?v=2" alt="" width="44" height="44" />
          <div className="brand-text">
            <h1 className="brand-name">Clever</h1>
            <div className="brand-sub">
              <span className="brand-sub-line" />
              Bitácora de vuelo
              <span className="brand-sub-line brand-sub-line-fade" />
            </div>
          </div>
        </div>
        <div className="header-right">
          {cloudError && <span className="cloud-error" title={cloudError}>⚠ nube: {cloudError}</span>}
          <select
            className="curso-select"
            value={curso.id}
            onChange={(e) => setData((d) => ({ ...d, activeCursoId: e.target.value }))}
          >
            {data.cursos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="account-menu" ref={menuRef}>
            <button
              className={`profile-btn ${menuOpen ? "profile-btn-open" : ""}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={isMobile ? "Perfil" : "Menú de cuenta"}
              aria-expanded={menuOpen}
            >
              <AccountAvatar url={headerPhoto} letter={(session.user.email || "?").charAt(0).toUpperCase()} />
            </button>
            {menuOpen && !isMobile && (
              <div className="account-dropdown acc-desktop">
                <div className="acc-head">
                  <span className="acc-avatar"><AccountAvatar url={headerPhoto} letter={(session.user.email || "?").charAt(0).toUpperCase()} /></span>
                  <div className="acc-head-txt">
                    <div className="acc-name">Mi cuenta</div>
                    <div className="acc-email">{session.user.email}</div>
                  </div>
                </div>

                <div className="acc-section">CUENTA</div>
                <AccRow icon="social" onClick={() => { setMenuOpen(false); setSocialSettingsOpen(true); }}>Ajustes de Social</AccRow>
                {supportsPasskey && !passkeyRegistered && (
                  <AccRow icon="huella" onClick={registerPasskey} disabled={passkeyBusy}>{passkeyBusy ? "Activando…" : "Activar huella"}</AccRow>
                )}
                {passkeyMsg && (
                  <div className={`account-dropdown-note ${passkeyMsg.startsWith("Error") ? "account-dropdown-note-error" : "account-dropdown-note-ok"}`}>
                    {passkeyMsg}
                  </div>
                )}
                <AccRow icon={theme === "dark" ? "sol" : "luna"} onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
                  {theme === "dark" ? "Modo claro" : "Modo oscuro"}
                </AccRow>

                <div className="acc-section">HERRAMIENTAS</div>
                <AccRow
                  icon="excel" disabled={!isPremium || exportBusy}
                  onClick={() => { setMenuOpen(false); handleExportExcel(); }}
                  title={isPremium ? `Descarga un Excel del curso ${curso?.name ?? "actual"}: registro diario, resumen con fórmulas y gráficas` : "Exportar a Excel está disponible en los planes de pago"}
                >
                  {exportBusy ? "Generando…" : "Exportar a Excel"}
                </AccRow>
                {exportError && <div className="account-dropdown-note account-dropdown-note-error">⚠ {exportError}</div>}
                <AccRow icon="novedades" dot={!newsSeen} onClick={() => { setMenuOpen(false); setNewsOpen("manual"); }}>Novedades</AccRow>
                <AccRow icon="web" href={APP_SHARE_URL} onClick={() => setMenuOpen(false)}>Web de Clever</AccRow>
                <AccRow icon="reportar" onClick={() => { setMenuOpen(false); setReportOpen(true); }}>Reportar un problema</AccRow>

                <div className="account-dropdown-divider" />
                <AccRow icon="salir" onClick={onSignOut}>Cerrar sesión</AccRow>
                <AccRow icon="borrar" danger onClick={() => { setMenuOpen(false); setDeleteConfirmOpen(true); }}>Eliminar cuenta</AccRow>
              </div>
            )}
            {menuOpen && isMobile && (
              <div className="account-dropdown">
                <div className="account-dropdown-email">{session.user.email}</div>
                {supportsPasskey && !passkeyRegistered && (
                  <button
                    className="account-dropdown-row"
                    onClick={registerPasskey}
                    disabled={passkeyBusy}
                  >
                    {passkeyBusy ? "Activando…" : "Activar huella"}
                  </button>
                )}
                {passkeyMsg && (
                  <div className={`account-dropdown-note ${passkeyMsg.startsWith("Error") ? "account-dropdown-note-error" : "account-dropdown-note-ok"}`}>
                    {passkeyMsg}
                  </div>
                )}
                {!isMobile && <button
                  className="account-dropdown-row"
                  onClick={() => { setMenuOpen(false); handleExportExcel(); }}
                  disabled={!isPremium || exportBusy}
                  title={isPremium ? `Descarga un Excel del curso ${curso?.name ?? "actual"}: registro diario, resumen con fórmulas y gráficas` : "Exportar a Excel está disponible en los planes de pago"}
                >
                  📊 {exportBusy ? "Generando…" : "Exportar a Excel"}
                </button>}
                {exportError && <div className="account-dropdown-note account-dropdown-note-error">⚠ {exportError}</div>}
                {isMobile ? (
                  <div className="account-dropdown-row account-dropdown-switch">
                    <span>Modo oscuro</span>
                    <button
                      type="button" role="switch" aria-checked={theme === "dark"} aria-label="Modo oscuro"
                      className={`switch ${theme === "dark" ? "switch-on" : ""}`}
                      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                    ><span className="switch-knob" /></button>
                  </div>
                ) : (
                  <>
                    <button
                      className="account-dropdown-row"
                      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                    >
                      {theme === "dark" ? "☀️ Modo claro" : "🌙 Modo oscuro"}
                    </button>
                    <button className="account-dropdown-row" onClick={() => { setMenuOpen(false); setNewsOpen("manual"); }}>
                      🚀 Novedades
                    </button>
                    <a className="account-dropdown-row" href={APP_SHARE_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                      🌐 Web de Clever
                    </a>
                    <button className="account-dropdown-row" onClick={() => { setMenuOpen(false); setReportOpen(true); }}>
                      🐞 Reportar un problema
                    </button>
                  </>
                )}
                <button className="account-dropdown-row" onClick={() => { setMenuOpen(false); setSocialSettingsOpen(true); }}>
                  👥 Ajustes de Social
                </button>
                <button className="account-dropdown-row" onClick={onSignOut}>Cerrar sesión</button>
                <div className="account-dropdown-divider" />
                <button
                  className="account-dropdown-row account-dropdown-row-danger"
                  onClick={() => { setMenuOpen(false); setDeleteConfirmOpen(true); }}
                >
                  Eliminar cuenta
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {socialSettingsOpen && (
        <SocialSettingsModal userId={userId} googleAvatarUrl={googleAvatar} onClose={() => { setSocialSettingsOpen(false); setSocialKey((k) => k + 1); refreshSocialPhoto(); }} />
      )}

      {newsOpen && (
        <NewsModal
          onClose={closeNews}
          onReport={() => { closeNews(false); setReportOpen(true); }}
          showDontShowAgain={newsOpen === "auto"}
        />
      )}
      {reportOpen && <BugReportModal onClose={() => setReportOpen(false)} userId={session.user.id} tab={tab} />}

      {deleteConfirmOpen && (
        <Modal
          title="Eliminar cuenta"
          onClose={() => { setDeleteConfirmOpen(false); setDeleteConfirmText(""); setDeleteAccountErr(null); }}
        >
          <p className="panel-subtitle">
            Esto borra para siempre todos tus cursos, asignaturas y registros de estudio. No se puede deshacer.
            Escribe <strong>ELIMINAR</strong> para confirmar.
          </p>
          <input
            className="input-field"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="ELIMINAR"
            autoFocus
          />
          {deleteAccountErr && <div className="auth-error">{deleteAccountErr}</div>}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              className="btn-primary btn-danger"
              onClick={handleDeleteAccount}
              disabled={deletingAccount || deleteConfirmText.trim().toUpperCase() !== "ELIMINAR"}
            >
              {deletingAccount ? "Eliminando…" : "Eliminar cuenta y todos mis datos"}
            </button>
            <button
              className="btn-ghost"
              onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText(""); setDeleteAccountErr(null); }}
              disabled={deletingAccount}
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {DISABLE_CLOUD_SAVE && (
        <div className="preview-banner">
          Vista previa de solo lectura: los cambios que hagas aquí no se guardan en la nube compartida.
        </div>
      )}

      {!isMobile && (
        <nav className="tab-bar">
          <Tab id="bitacora" active={tab === "bitacora"} onClick={setTab}>Bitácora</Tab>
          <Tab id="trayectoria" active={tab === "trayectoria"} onClick={setTab}>Trayectoria</Tab>
          <Tab id="panel" active={tab === "panel"} onClick={setTab}>Panel</Tab>
          <Tab id="rangos" active={tab === "rangos"} onClick={setTab}>Rangos</Tab>
          <Tab id="desgaste" active={tab === "desgaste"} onClick={setTab}>Desgaste</Tab>
          <Tab id="clasificacion" active={tab === "clasificacion"} onClick={setTab}>Clasificación</Tab>
          <Tab id="social" active={tab === "social"} onClick={setTab}>Social</Tab>
          <Tab id="asignaturas" active={tab === "asignaturas"} onClick={setTab}>Asignaturas</Tab>
        </nav>
      )}

      <main className="app-main">
        {tab === "bitacora" && (
          <BitacoraTab
            cursoSubjects={cursoSubjects}
            loggableSubjects={loggableSubjects}
            entries={cursoEntries}
            logs={cursoLogs}
            onSaveEntries={handleSaveEntries}
            onUpdateEntry={handleUpdateEntry}
            onDeleteEntry={handleDeleteEntry}
            curso={curso}
          />
        )}
        {tab === "rangos" && <RangosTab subjects={data.subjects} entries={data.entries} logs={data.logs} />}
        {tab === "panel" && <PanelTab stats={stats} />}
        {tab === "trayectoria" && <TrayectoriaTab cursoSubjects={cursoSubjects} entries={cursoEntries} stats={stats} curso={curso} />}
        {tab === "desgaste" && <DesgasteTab cursoSubjects={cursoSubjects} subjects={data.subjects} entries={data.entries} />}
        {tab === "clasificacion" && (
          isPremium
            ? <ClasificacionTab subjects={data.subjects} entries={data.entries} />
            : <PremiumLocked feature="la Clasificación histórica" />
        )}
        {tab === "social" && (
          <SocialTab
            key={socialKey}
            userId={userId}
            avatarUrl={googleAvatar}
            onOwnPhoto={setSocialPhoto}
            carreraId={profile?.carrera_canonica_id ?? null}
            onOpenSettings={() => setSocialSettingsOpen(true)}
            subjects={data.subjects}
            entries={data.entries}
            logs={data.logs}
            pendingInvite={pendingInvite}
            onInviteHandled={() => { clearPendingInvite(); setPendingInvite(null); }}
            onBack={null}
            isMobile={isMobile}
          />
        )}
        {tab === "asignaturas" && (
          <AsignaturasTab
            subjects={data.subjects}
            cursoSubjects={cursoSubjectsForManagement}
            entries={data.entries}
            profile={profile}
            cursos={data.cursos}
            activeCursoId={data.activeCursoId}
            onSelectCurso={(id) => setData((d) => ({ ...d, activeCursoId: id }))}
            onAddSubject={handleAddSubject}
            onDeleteSubject={handleDeleteSubject}
            onUpdateSubject={handleUpdateSubject}
            onChangeEstado={handleChangeEstado}
            onApprove={handleApprove}
            onAddCurso={handleAddCurso}
            onRemoveCurso={handleRemoveCurso}
            onToggleCursoEstado={handleToggleCursoEstado}
          />
        )}
      </main>

      {isMobile && (
        <>
          <BottomNav
            tab={tab}
            moreOpen={moreOpen}
            newsDot={!newsSeen}
            onSelect={(id) => { setMoreOpen(false); setTab(id); }}
            onMore={() => setMoreOpen((v) => !v)}
          />
          {moreOpen && (
            <MoreSheet
              onClose={() => setMoreOpen(false)}
              onGo={(id) => { setMoreOpen(false); setTab(id); }}
              newsDot={!newsSeen}
              isPremium={isPremium}
              exportBusy={exportBusy}
              onExport={() => { setMoreOpen(false); handleExportExcel(); }}
              onNews={() => { setMoreOpen(false); setNewsOpen("manual"); }}
              onReport={() => { setMoreOpen(false); setReportOpen(true); }}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ESTILOS                                                             */
/* ------------------------------------------------------------------ */

export const CSS = `
  html, body { background: var(--bg); margin: 0; }
  :root {
    --bg: #0A0F1C;
    --bg-glow: #101B30;
    --panel: #121A2B;
    --panel-2: #1A2438;
    --border: #26324A;
    --text: #E7ECF5;
    --text-dim: #8291AC;
    --cyan: #4FD8EA;
    --cyan-text: #4FD8EA;
    --amber: #F5A623;
    --green: #3DDC84;
    --red: #FF5C5C;
    --purple: #A78BFA;
  }
  /* Modo claro: fondo/texto/bordes cambian, pero --cyan, --amber, --green,
     --red y --purple se mantienen iguales en ambos modos — son los mismos
     colores que usan las gráficas (fijos en el propio SVG) y los botones/
     pestañas con fondo de color, así que nada cambia de significado ni de
     contraste ahí. La excepción es --cyan-text: se usa aparte para números
     grandes en texto plano (Panel, Clasificación, cronómetro), donde el
     cian original quedaba deslavado sobre fondo blanco; y --purple, que
     solo se usa como texto (nunca de fondo), así que se puede oscurecer
     entero sin ese problema. */
  [data-theme="light"] {
    --bg: #FFFFFF;
    --bg-glow: #EAF2FF;
    --panel: #F5F7FA;
    --panel-2: #EBEEF3;
    --border: #DBE1EA;
    --text: #12161F;
    --text-dim: #5B6472;
    --cyan-text: #0E8FA6;
    --purple: #6D4FEE;
  }
  .app-shell {
    background: radial-gradient(1200px 600px at 50% -10%, var(--bg-glow) 0%, var(--bg) 60%);
    min-height: 100vh;
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 20px 16px 60px;
    overflow-x: hidden;
  }
  .app-loading { display: flex; align-items: center; justify-content: center; }
  .mono { font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace; }
  .app-header {
    max-width: 1080px; margin: 0 auto 18px; display: flex; justify-content: space-between;
    align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--border); padding-bottom: 16px;
  }
  .app-header { position: relative; border-bottom-color: transparent; }
  /* Estela bajo la cabecera: sale del logo y se desvanece, como la del cohete. */
  .app-header::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; border-radius: 2px;
    background: linear-gradient(90deg, var(--cyan) 0%, rgba(79,216,234,0.35) 35%, var(--border) 70%, transparent 100%);
  }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .brand-logo {
    width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0;
    box-shadow: 0 0 0 1px rgba(79,216,234,0.25), 0 6px 18px rgba(20,57,110,0.55);
  }
  .brand-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .brand-name {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.02em; line-height: 1;
    background: linear-gradient(90deg, var(--text) 0%, var(--cyan-text) 115%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .brand-sub {
    display: flex; align-items: center; gap: 8px; font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace;
    font-size: 10.5px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-dim); white-space: nowrap;
  }
  .brand-sub-line { display: inline-block; width: 14px; height: 1px; background: var(--cyan); opacity: 0.8; }
  .brand-sub-line-fade { width: 28px; background: linear-gradient(90deg, var(--cyan), transparent); }
  .report-textarea { width: 100%; resize: vertical; min-height: 110px; font: inherit; box-sizing: border-box; }
  .report-check { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: var(--text-dim); margin: 10px 0 2px; cursor: pointer; }
  .report-send { text-decoration: none; display: inline-flex; align-items: center; }
  .report-send-disabled { opacity: 0.5; cursor: not-allowed; }
  .news { display: flex; flex-direction: column; gap: 18px; }
  .news-item { display: flex; gap: 14px; }
  .news-icon {
    font-size: 20px; width: 40px; height: 40px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    border-radius: 10px; background: var(--panel-2); border: 1px solid var(--border);
  }
  .news-title { font-weight: 700; font-size: 14px; margin: 2px 0 6px; }
  .news-list { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.55; color: var(--text-dim); display: flex; flex-direction: column; gap: 5px; }
  .news-list strong, .news-text strong { color: var(--text); }
  .news-text { font-size: 13px; line-height: 1.55; color: var(--text-dim); margin: 0 0 10px; }
  .news-text a { color: var(--cyan-text); }
  .news-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--border); }
  .header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
  .account-menu { position: relative; }
  .menu-trigger { font-size: 16px; line-height: 1; padding: 8px 12px; }
  .account-dropdown {
    position: absolute; top: calc(100% + 8px); right: 0; z-index: 30; min-width: 240px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.35); padding: 8px; display: flex; flex-direction: column; gap: 2px;
  }
  .account-dropdown-email {
    font-size: 12px; color: var(--text-dim); padding: 8px 10px 10px; word-break: break-all;
    border-bottom: 1px solid var(--border); margin-bottom: 4px;
  }
  .account-dropdown-row {
    display: block; width: 100%; text-align: left; background: none; border: none; color: var(--text);
    font-size: 13.5px; padding: 9px 10px; border-radius: 8px; cursor: pointer;
  }
  .account-dropdown-row:hover:not(:disabled) { background: var(--panel-2); }
  .account-dropdown-row:disabled { opacity: 0.5; cursor: not-allowed; }
  .account-dropdown-row-danger { color: var(--red); }
  .account-dropdown-divider { height: 1px; background: var(--border); margin: 4px 2px; }
  .account-dropdown-note { font-size: 11.5px; padding: 2px 10px 6px; }
  .account-dropdown-note-ok { color: var(--green); }
  .account-dropdown-note-error { color: var(--red); }
  .auth-card { max-width: 360px; width: 100%; }
  .password-field { position: relative; flex: 1; }
  .password-field .input-field { width: 100%; padding-right: 38px; }
  .password-toggle {
    position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; font-size: 15px; padding: 4px 6px; line-height: 1;
  }
  .auth-error { color: var(--red); font-size: 13px; margin: 8px 0; }
  .ob-step { display: flex; align-items: center; gap: 10px; font-size: 11px; letter-spacing: 0.08em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 12px; }
  .ob-bar { flex: 1; height: 4px; border-radius: 999px; background: var(--border); overflow: hidden; }
  .ob-bar i { display: block; height: 100%; background: var(--cyan); border-radius: 999px; }
  .ob-out { margin: 22px 0 0; font-size: 11px; color: var(--text-dim); text-align: center; overflow-wrap: anywhere; }
  .ob-out button { background: none; border: 0; padding: 0; font: inherit; color: var(--text-dim); text-decoration: underline; cursor: pointer; }
  .ob-out button:hover { color: var(--text); }
  .auth-info { color: var(--cyan); font-size: 13px; margin: 8px 0; }
  .auth-link {
    display: block; background: none; border: none; color: var(--text-dim); font-size: 12px;
    text-decoration: underline; cursor: pointer; margin-top: 12px; padding: 0;
  }
  .auth-link:hover { color: var(--cyan); }
  .auth-divider {
    display: flex; align-items: center; gap: 10px; margin: 16px 0 4px; color: var(--text-dim);
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;
  }
  .auth-divider::before, .auth-divider::after { content: ""; flex: 1; height: 1px; background: var(--border); }
  .cloud-error {
    font-size: 10.5px; color: var(--red); background: rgba(255,92,92,0.1); border: 1px solid rgba(255,92,92,0.3);
    border-radius: 20px; padding: 4px 10px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .curso-select {
    background: var(--panel); border: 1px solid var(--border); color: var(--text); border-radius: 8px;
    padding: 8px 10px; font-size: 13px; font-family: ui-monospace, monospace;
  }
  @media (max-width: 640px) {
    .header-right { width: 100%; }
  }

  .preview-banner {
    max-width: 1080px; margin: 0 auto 16px; background: rgba(245,166,35,0.1); border: 1px solid rgba(245,166,35,0.35);
    color: var(--amber); font-size: 12.5px; padding: 10px 14px; border-radius: 10px;
  }

  .tab-bar { max-width: 1080px; margin: 0 auto 20px; display: flex; gap: 6px; flex-wrap: wrap; }
  .tab-btn {
    font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
    background: var(--panel); border: 1px solid var(--border); color: var(--text-dim);
    padding: 9px 16px; border-radius: 8px; cursor: pointer; transition: all 0.15s ease;
  }
  .tab-btn:hover { color: var(--text); border-color: #34435F; }
  .tab-btn-active { color: var(--bg); background: var(--cyan); border-color: var(--cyan); font-weight: 700; }

  .app-main { max-width: 1080px; margin: 0 auto; }

  ${SOCIAL_CSS}
  ${AVATAR_CSS}

  /* ---- Menú de cuenta en PC: mismas secciones que el panel "Más" del móvil ---- */
  .acc-desktop { min-width: 290px; padding: 10px; gap: 0; }
  .acc-head { display: flex; align-items: center; gap: 12px; padding: 6px 8px 12px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
  .acc-avatar { width: 40px; height: 40px; border-radius: 20px; overflow: hidden; background: #12314a; color: var(--cyan); border: 1px solid #24406b; display: flex; align-items: center; justify-content: center; font-weight: 700; flex: none; }
  .acc-head-txt { min-width: 0; }
  .acc-name { font-size: 14px; font-weight: 700; }
  .acc-email { font-size: 12px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .acc-section { padding: 12px 8px 4px; font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 10px; letter-spacing: 0.18em; color: var(--text-dim); }
  .acc-row {
    display: flex; align-items: center; gap: 12px; width: 100%; padding: 7px 8px; border: none; background: none; border-radius: 10px;
    color: var(--text); font-size: 13.5px; text-align: left; cursor: pointer; text-decoration: none;
  }
  .acc-row:hover:not(:disabled) { background: var(--panel-2); }
  .acc-row:disabled { opacity: 0.5; cursor: not-allowed; }
  .acc-icon { width: 30px; height: 30px; border-radius: 9px; background: var(--panel-2); color: var(--cyan-text); display: flex; align-items: center; justify-content: center; flex: none; }
  .acc-row:hover:not(:disabled) .acc-icon { background: var(--bg); }
  .acc-text { flex: 1; min-width: 0; }
  .acc-row-danger, .acc-row-danger .acc-icon { color: var(--red); }

  /* ---- Navegación móvil: barra inferior, panel "Más" y perfil ---- */
  .bottom-nav, .more-overlay { display: none; }
  .profile-btn {
    width: 44px; height: 44px; border-radius: 22px; padding: 0; cursor: pointer; font-size: 17px; font-weight: 700;
    background: #12314a; color: var(--cyan); border: 1px solid #24406b;
  }
  .profile-btn-open { border: 2px solid var(--cyan); }
  .account-dropdown-switch { display: flex; align-items: center; justify-content: space-between; cursor: default; }
  .switch { position: relative; width: 48px; height: 28px; padding: 0; border: 0; border-radius: 14px; background: var(--border); cursor: pointer; }
  .switch-on { background: var(--cyan); }
  .switch-knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 11px; background: #06121f; transition: left 0.15s ease; }
  .switch-on .switch-knob { left: 23px; }
  @media (max-width: 640px) {
    .app-shell { padding-bottom: 100px; }
    .app-header { flex-wrap: nowrap; gap: 10px; padding-bottom: 12px; }
    .app-header .header-right { width: auto; flex-wrap: nowrap; gap: 8px; }
    .brand { flex: 1; }
    .brand-name { font-size: 24px; }
    .brand-sub { font-size: 10px; letter-spacing: 0.1em; }
    .brand-sub-line { display: none; }
    .curso-select { height: 44px; font-size: 13px; padding: 0 8px; border-radius: 12px; }
    .account-dropdown { position: fixed; top: 76px; right: 12px; width: 300px; max-width: calc(100vw - 24px); }
    .account-dropdown-row { min-height: 44px; font-size: 16px; }

    .bottom-nav {
      display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; height: 76px; box-sizing: border-box;
      padding: 6px 4px 14px; background: var(--panel); border-top: 1px solid var(--border);
    }
    .bn-item {
      flex: 1 1 0; min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
      background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 0;
    }
    .bn-icon { position: relative; width: 52px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 15px; }
    .bn-label { font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }
    .bn-active { color: var(--cyan); }
    .bn-active .bn-icon { background: #12314a; }
    .bn-active .bn-label { font-weight: 600; }
    .bn-dot { position: absolute; top: 2px; right: 10px; width: 8px; height: 8px; border-radius: 4px; background: var(--cyan); border: 2px solid var(--panel); box-sizing: content-box; }
    .bn-dot-inline { position: static; border: 0; width: 8px; height: 8px; }

    .more-overlay { display: block; position: fixed; inset: 0; bottom: 76px; z-index: 35; background: rgba(0,0,0,0.72); }
    .more-sheet {
      position: absolute; left: 12px; right: 12px; bottom: 12px; box-sizing: border-box; padding: 10px 8px 8px;
      border-radius: 22px; background: var(--panel); border: 1px solid var(--border); display: flex; flex-direction: column;
      max-height: 100%; overflow-y: auto;
    }
    .more-handle { align-self: center; width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin-bottom: 8px; }
    .more-section { padding: 0 12px 6px; font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.2em; color: var(--text-dim); }
    .more-divider { margin: 8px 12px 0; border-top: 1px solid var(--border); padding-bottom: 10px; }
    .more-row {
      min-height: 56px; padding: 0 12px; display: flex; align-items: center; gap: 14px; border-radius: 14px;
      background: none; border: none; color: var(--text); font-size: 16px; text-align: left; cursor: pointer; width: 100%;
    }
    .more-row:disabled { opacity: 0.5; cursor: not-allowed; }
    .more-row-icon { width: 36px; height: 36px; border-radius: 10px; background: var(--panel-2); display: flex; align-items: center; justify-content: center; color: var(--cyan); flex-shrink: 0; }
    .more-row-text { flex: 1; }
    .more-row-arrow { color: var(--text-dim); display: flex; }
  }

  .panel {
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
    padding: 20px; margin-bottom: 16px;
  }
  .panel-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .panel-title-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
  .panel-subtitle { font-size: 12px; color: var(--text-dim); margin-bottom: 16px; line-height: 1.5; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 760px) { .grid-2 { grid-template-columns: 1fr; } }

  .field-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
  .field-label { font-size: 13px; color: var(--text-dim); display: flex; align-items: center; gap: 8px; flex: 1; }
  .recharts-wrapper, .recharts-wrapper *, .recharts-surface { outline: none !important; -webkit-tap-highlight-color: transparent; }
  .recharts-wrapper *:focus, .recharts-wrapper *:focus-visible { outline: none !important; }
  .tray-legend { display: flex; flex-wrap: wrap; gap: 6px 8px; margin-bottom: 10px; }
  .tray-legend-item { display: flex; align-items: center; gap: 4px; max-width: 100%; background: var(--panel-2); border: 1px solid var(--border); border-radius: 999px; padding: 3px 4px 3px 10px; font-size: 12px; }
  .tray-legend-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .tray-legend-off .tray-legend-name, .tray-legend-off .dot { opacity: .4; }
  .tray-legend-btn { flex-shrink: 0; background: transparent; border: 1px solid var(--border); color: var(--text-dim); border-radius: 999px; font-size: 10.5px; padding: 4px 9px; cursor: pointer; margin-left: 4px; }
  .tray-legend-btn:hover { color: var(--text); border-color: var(--cyan); }
  .color-picker { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-right: 6px; vertical-align: middle; }
  .color-options { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 0; }
  .color-swatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
  .color-swatch-current { border-color: var(--border); }
  .color-swatch-on { border-color: var(--text); }
  @media (pointer: coarse) { .color-swatch { width: 30px; height: 30px; } }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; margin-right: 6px; }
  .input-field {
    background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px;
    padding: 8px 10px; font-size: 13px; font-family: inherit; width: 100%;
  }
  .input-field:focus { outline: none; border-color: var(--cyan); }
  .input-with-unit { display: flex; align-items: center; gap: 6px; width: 130px; }
  .input-num { width: 90px; text-align: right; font-family: ui-monospace, monospace; }
  .input-inline { padding: 6px 8px; font-size: 13px; }
  .estado-select { width: auto; min-width: 110px; }
  .subject-select { width: auto; max-width: 220px; }
  .unit-tag { font-size: 11px; color: var(--text-dim); }
  .subject-inputs { margin: 14px 0; }
  .timer-box { margin: 14px 0; }
  .timer-display {
    font-size: 42px; font-weight: 800; text-align: center; letter-spacing: 0.03em;
    padding: 18px 0 6px; color: var(--cyan-text);
  }
  .day-total-row {
    display: flex; justify-content: space-between; font-size: 13px; color: var(--text-dim);
    border-top: 1px dashed var(--border); padding-top: 12px; margin-top: 6px;
  }
  .btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
  .btn-primary {
    background: var(--cyan); color: #06131C; border: none; border-radius: 8px; padding: 10px 18px;
    font-weight: 700; font-size: 13px; cursor: pointer;
  }
  .btn-primary:hover { filter: brightness(1.08); }
  .btn-primary.btn-danger { background: var(--red); color: #fff; }
  .btn-ghost {
    background: transparent; border: 1px solid var(--border); color: var(--text-dim); border-radius: 8px;
    padding: 10px 16px; font-size: 13px; cursor: pointer;
  }
  .btn-ghost:hover { color: var(--red); border-color: rgba(255,92,92,0.4); }
  .btn-primary:disabled, .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }
  .btn-small { padding: 6px 10px; font-size: 12px; }
  .share-btn { display: inline-flex; align-items: center; gap: 6px; }
  .btn-danger {
    background: var(--red); color: #2A0E0E; border: none; border-radius: 8px; padding: 10px 18px;
    font-weight: 700; font-size: 13px; cursor: pointer;
  }
  .btn-danger:hover { filter: brightness(1.1); }

  .empty-hint { color: var(--text-dim); font-size: 13px; padding: 20px 0; text-align: center; }
  .log-list { display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; }
  .log-caret { font-size: 11px; color: var(--text-dim); width: 12px; flex-shrink: 0; }
  .log-detail .gauge-sub { align-self: center; }
  .session-list { display: flex; flex-direction: column; gap: 6px; padding: 8px 0 4px 22px; }
  .session-row { display: flex; align-items: center; gap: 8px; }
  .session-row .log-date { width: 44px; }
  .session-row .input-num { width: 76px; }
  .form-ok { color: var(--green); font-size: 13px; margin: 8px 0; }
  .log-item {
    display: flex; align-items: center; gap: 10px; background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 12px; cursor: pointer; text-align: left; width: 100%;
  }
  .log-item:hover { border-color: var(--cyan); }
  .log-date { font-family: ui-monospace, monospace; font-size: 12px; color: var(--text-dim); width: 56px; flex-shrink: 0; }
  .log-detail { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
  .log-chip { font-size: 11px; border: 1px solid; border-radius: 20px; padding: 2px 8px; color: var(--text-dim); }
  .log-total { font-size: 12px; color: var(--text); flex-shrink: 0; }
  .history-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }

  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
  @media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
  .stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
  .stat-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px; }
  .stat-value { font-family: ui-monospace, monospace; font-size: 20px; font-weight: 700; }
  .stat-hint { font-size: 11px; color: var(--text-dim); margin-top: 4px; }

  .gauge-row { margin-bottom: 18px; }
  .gauge-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
  .gauge-label { font-size: 13px; color: var(--text); }
  .gauge-value { font-family: ui-monospace, monospace; font-size: 13px; color: var(--text); }
  .gauge-unit { font-size: 10px; color: var(--text-dim); margin-left: 2px; }
  .gauge-track { position: relative; height: 10px; background: var(--panel-2); border-radius: 6px; border: 1px solid var(--border); overflow: visible; }
  .gauge-fill { height: 100%; border-radius: 6px; transition: width 0.3s ease; }
  .gauge-ticks { position: absolute; inset: 0; }
  .gauge-tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.06); }
  .gauge-target { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); box-shadow: 0 0 4px rgba(255,255,255,0.6); }
  .gauge-sub { font-size: 11px; color: var(--text-dim); margin-top: 6px; }

  /* Tarjeta para compartir la Clasificación (ver ClassificationShareCard):
     ancho fijo y fondo propio con degradado — pensada solo para hacerle
     una foto, nunca para enseñarse en pantalla. */
  .share-card-offscreen { position: fixed; top: 0; left: -10000px; pointer-events: none; }
  .share-card {
    width: 420px; box-sizing: border-box; padding: 30px 26px 22px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #F4F7FC;
    background:
      radial-gradient(120% 120% at 10% -10%, rgba(79,216,234,0.38), transparent 55%),
      radial-gradient(120% 120% at 105% 115%, rgba(167,139,250,0.4), transparent 55%),
      linear-gradient(165deg, #0A0E1B 0%, #101830 55%, #180F28 100%);
  }
  .share-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
  .share-card-logo { border-radius: 8px; display: block; }
  .share-card-brand { font-size: 15px; font-weight: 700; letter-spacing: 0.01em; }
  .share-card-title { font-size: 25px; font-weight: 800; line-height: 1.2; margin-bottom: 4px; }
  .share-card-subtitle {
    font-size: 12px; font-weight: 600; color: rgba(244,247,252,0.6); text-transform: uppercase;
    letter-spacing: 0.06em; margin-bottom: 22px;
  }
  .share-card-list { display: flex; flex-direction: column; gap: 13px; }
  .share-card-row { display: flex; align-items: center; gap: 12px; }
  .share-card-rank {
    width: 26px; height: 26px; flex: none; border-radius: 50%; display: flex; align-items: center;
    justify-content: center; font-size: 11.5px; font-weight: 800; background: rgba(244,247,252,0.12);
    color: rgba(244,247,252,0.7);
  }
  .share-card-rank-1 { background: linear-gradient(135deg, #4FD8EA, #2FB9CC); color: #04222A; }
  .share-card-rank-2 { background: linear-gradient(135deg, #A78BFA, #7C5CE0); color: #1B1030; }
  .share-card-rank-3 { background: linear-gradient(135deg, #F5A623, #D98A12); color: #2A1900; }
  .share-card-dot { width: 9px; height: 9px; flex: none; border-radius: 50%; }
  .share-card-name {
    flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 600; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .share-card-value { flex: none; font-size: 13px; font-weight: 700; font-family: ui-monospace, monospace; color: #4FD8EA; }
  .share-card-footer {
    margin-top: 26px; padding-top: 14px; border-top: 1px solid rgba(244,247,252,0.14);
    font-size: 11px; color: rgba(244,247,252,0.5); text-align: center; letter-spacing: 0.03em;
  }

  .table-wrap { overflow-x: auto; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .data-table th {
    text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim);
    padding: 8px 10px; border-bottom: 1px solid var(--border); font-weight: 600;
  }
  .data-table td { padding: 9px 10px; border-bottom: 1px solid rgba(38,50,74,0.5); }
  .data-table tr:last-child td { border-bottom: none; }
  .sortable-th { cursor: pointer; user-select: none; }
  .sortable-th:hover { color: var(--text); }
  .clickable-row { cursor: pointer; }
  .clickable-row:hover td { background: rgba(79,216,234,0.05); }

  .seg-control { display: flex; gap: 4px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 3px; }
  .seg-btn { background: transparent; border: none; color: var(--text-dim); font-size: 11px; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-family: ui-monospace, monospace; }
  .seg-btn-active { background: var(--cyan); color: #06131C; font-weight: 700; }

  .curso-list { display: flex; gap: 8px; flex-wrap: wrap; }
  .curso-chip { display: flex; align-items: center; border: 1px solid var(--border); border-radius: 20px; overflow: hidden; }
  .curso-chip button { background: var(--panel-2); color: var(--text-dim); border: none; padding: 8px 14px; font-size: 12px; cursor: pointer; font-family: ui-monospace, monospace; }
  .curso-chip-active button { background: var(--cyan); color: #06131C; font-weight: 700; }
  .curso-badge { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; margin-left: 6px; }
  .curso-remove { padding: 0 10px; color: var(--text-dim); cursor: pointer; font-size: 14px; }
  .curso-remove:hover { color: var(--red); }

  .badge-estado {
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; padding: 3px 9px; border-radius: 20px;
    border: 1px solid; white-space: nowrap;
  }
  .badge-estado-en_curso { color: var(--cyan); border-color: rgba(79,216,234,0.4); background: rgba(79,216,234,0.08); }
  .badge-estado-suspendida { color: var(--amber); border-color: rgba(245,166,35,0.4); background: rgba(245,166,35,0.08); }
  .badge-estado-aprobada { color: var(--green); border-color: rgba(61,220,132,0.4); background: rgba(61,220,132,0.08); }

  .wear-card { padding: 18px 20px 20px; }
  .wear-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .wear-card-head strong { font-size: 15px; }
  .wear-provisional { font-size: 10px; color: var(--text-dim); margin-left: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
  .wear-index-row { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
  .wear-index-value {
    font-family: ui-monospace, monospace; font-size: 46px; font-weight: 800; line-height: 1;
    min-width: 78px; text-align: right;
  }
  .wear-index-sub { font-size: 12px; color: var(--text-dim); margin-top: 6px; line-height: 1.5; max-width: 440px; }
  .wear-label { font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
  .wear-label-llevadero { color: var(--green); background: rgba(61,220,132,0.1); }
  .wear-label-moderado { color: var(--cyan); background: rgba(79,216,234,0.1); }
  .wear-label-duro { color: var(--amber); background: rgba(245,166,35,0.1); }
  .wear-label-extremo { color: var(--red); background: rgba(255,92,92,0.1); }
  .wear-factors { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  @media (max-width: 560px) { .wear-factors { grid-template-columns: 1fr; } }
  .wear-factor-card { background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
  .wear-factor-label { font-size: 12.5px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .wear-factor-raw { font-family: ui-monospace, monospace; font-size: 20px; font-weight: 700; color: var(--cyan-text); margin-bottom: 6px; }
  .wear-factor-explain { font-size: 11.5px; color: var(--text-dim); line-height: 1.45; }

  .merge-select { margin-top: 6px; font-size: 11.5px; color: var(--text-dim); padding: 5px 8px; }

  .canonical-picker { position: relative; flex: 1; min-width: 200px; }
  .canonical-picker-results {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.35); max-height: 240px; overflow-y: auto;
  }
  .canonical-picker-hint { padding: 8px 12px; font-size: 12px; color: var(--text-dim); }
  .canonical-picker-option {
    display: block; width: 100%; text-align: left; padding: 8px 12px; font-size: 13px;
    background: transparent; border: none; border-bottom: 1px solid var(--border); color: var(--text); cursor: pointer;
  }
  .canonical-picker-option:last-child { border-bottom: none; }
  .canonical-picker-option:hover { background: var(--panel-2); }
  .canonical-picker-create { color: var(--cyan-text); font-style: italic; }
  .canonical-picker-hint-inline { color: var(--text-dim); font-size: 11.5px; }

  /* Filas de la pantalla de migración (NormalizationGate): en móvil no
     caben la etiqueta + el buscador + el botón en una sola línea, así que
     se envuelven y el buscador pasa a ocupar toda la anchura disponible en
     vez de forzar un min-width que desborda la tarjeta. */
  .norm-gate-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
  .norm-gate-label { flex: 1 1 130px; min-width: 130px; }
  @media (max-width: 520px) {
    .norm-gate-label,
    .norm-gate-row .canonical-picker,
    .norm-gate-row > .gauge-sub { flex: 1 1 100%; min-width: 0; }
  }

  .modal-overlay {
    position: fixed; inset: 0; background: rgba(6,10,20,0.7); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100;
  }
  .modal-box {
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 440px;
    max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .modal-box-wide { max-width: 640px; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .modal-title { font-size: 15px; font-weight: 700; }
  .modal-close { background: transparent; border: none; color: var(--text-dim); font-size: 22px; line-height: 1; cursor: pointer; padding: 0 4px; }
  .modal-close:hover { color: var(--red); }
  .modal-body { padding: 18px 20px; }

  /* --------------------------------------------------------------- */
  /*  PESTAÑA RANGOS — sigue el tema claro/oscuro de la app (variables  */
  /*  --rt-* propias, aisladas bajo .rt-wrap para no chocar con el      */
  /*  resto de clases). El hero de Rango y la escena de Racha (fotos    */
  /*  con degradado) se quedan siempre oscuros a propósito, igual que   */
  /*  la tarjeta para compartir de Clasificación (.share-card) — son    */
  /*  fotos con texto blanco encima, no "chrome" de la interfaz.        */
  /* --------------------------------------------------------------- */
  .rt-wrap {
    --rt-surface:#111a2e; --rt-surface-2:#0f1830; --rt-surface-3:#0d1628;
    --rt-border:#1c2843; --rt-border-strong:#23406f;
    --rt-text:#e9eff9; --rt-text-dim:#93a2c2; --rt-text-faint:#68779c;
    --rt-accent:#4fd8ee; --rt-accent-ink:#06222c; --rt-accent-dim:#1f6f80;
    --rt-good:#34d399; --rt-good-ink:#0f2a2a; --rt-good-bd:#1f6b52;
    --rt-warn:#fbbf24; --rt-warn-ink:#2a2210; --rt-warn-bd:#7a5a12;
    --rt-lock-ink:#0f1730; --rt-lock-bd:#26324f; --rt-lock-tx:#6b7a99;
    --rt-cur-bg:#0d2a36; --rt-cur-row-bg:#0d2230;
    color-scheme: dark;
  }
  [data-theme="light"] .rt-wrap {
    --rt-surface:#F5F7FA; --rt-surface-2:#EBEEF3; --rt-surface-3:#EDF1F6;
    --rt-border:#DBE1EA; --rt-border-strong:#B9C4D6;
    --rt-text:#12161F; --rt-text-dim:#5B6472; --rt-text-faint:#7A8496;
    --rt-accent:#0E8FA6; --rt-accent-ink:#FFFFFF; --rt-accent-dim:#8FD3DE;
    --rt-good:#1F9D74; --rt-good-ink:#E3FBF1; --rt-good-bd:#8FE1C4;
    --rt-warn:#B67B0A; --rt-warn-ink:#FFF3DA; --rt-warn-bd:#F0CE8B;
    --rt-lock-ink:#EEF1F6; --rt-lock-bd:#C7D0DE; --rt-lock-tx:#7C879C;
    --rt-cur-bg:#E3F7FA; --rt-cur-row-bg:#E3F7FA;
    color-scheme: light;
  }
  .rt-mono { font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .rt-eyebrow { font-size: 10.5px; letter-spacing: 1.6px; color: var(--rt-text-faint); text-transform: uppercase; }
  .rt-pill { display: inline-block; font-size: 11px; padding: 3px 10px; border-radius: 999px; border: 1px solid; letter-spacing: .4px; font-family: "IBM Plex Mono", monospace; }
  .rt-p-ok { color: var(--rt-good); border-color: var(--rt-good-bd); background: var(--rt-good-ink); }
  .rt-p-cur { color: var(--rt-accent); border-color: var(--rt-accent-dim); background: var(--rt-cur-bg); }
  .rt-p-lock { color: var(--rt-lock-tx); border-color: var(--rt-lock-bd); background: var(--rt-lock-ink); }
  .rt-p-live { color: var(--rt-warn); border-color: var(--rt-warn-bd); background: var(--rt-warn-ink); }

  .rt-seg { display: inline-flex; gap: 2px; background: var(--rt-surface-3); border: 1px solid var(--rt-border); border-radius: 10px; padding: 4px; margin-bottom: 16px; }
  .rt-seg button { border: none; background: transparent; color: var(--rt-text-dim); font-size: 12.5px; padding: 8px 16px; border-radius: 7px; font-family: "IBM Plex Mono", monospace; cursor: pointer; }
  .rt-seg button.rt-on { background: var(--rt-accent); color: var(--rt-accent-ink); font-weight: 600; }

  .rt-card { background: var(--rt-surface); border: 1px solid var(--rt-border); border-radius: 16px; padding: 16px; margin-bottom: 12px; color: var(--rt-text); }
  .rt-panel-actions { display: flex; justify-content: flex-end; margin-bottom: 10px; }

  .rt-hero {
    position: relative; border-radius: 16px; overflow: hidden; border: 1px solid var(--rt-border); min-height: 340px;
    margin-bottom: 12px; background: #0a0f1a; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
  }
  @media (min-width: 720px) {
    .rt-hero:not(.rt-hero-share), .rt-scene:not(.rt-scene-share) { max-width: 640px; margin-left: auto; margin-right: auto; }
  }
  .rt-hero .rt-sc { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .94; }
  .rt-hero .rt-tint { position: absolute; inset: 0; background: none; }
  .rt-hero .rt-season { position: absolute; top: 12px; left: 14px; font-size: 10.5px; letter-spacing: 2px; color: #d7e3f5; text-shadow: 0 1px 6px rgba(0,0,0,.9); z-index: 2; margin: 0; }
  .rt-hero .rt-prevtag { position: absolute; top: 12px; right: 14px; z-index: 2; }
  .rt-herocard { position: relative; z-index: 2; text-align: center; padding: 16px 16px 20px; width: 100%; }
  .rt-emwrap { position: relative; z-index: 2; display: flex; justify-content: center; margin-bottom: 2px; }
  .rt-emwrap img { width: 104px; height: auto; filter: drop-shadow(0 2px 8px rgba(0,0,0,.6)); }
  .rt-rname { font-family: "Manrope", sans-serif; font-size: 25px; font-weight: 700; line-height: 1.12; margin-top: 4px; color: #fff; text-shadow: 0 2px 16px rgba(0,0,0,.9), 0 0 4px rgba(0,0,0,.8); }
  .rt-rquip { font-size: 12.5px; color: #dbe6f5; margin-top: 5px; text-shadow: 0 1px 8px rgba(0,0,0,.9); }

  .rt-stats { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; margin-bottom: 12px; }
  .rt-stat { background: var(--rt-surface-2); border: 1px solid var(--rt-border); border-radius: 12px; padding: 11px 12px; }
  .rt-stat p:first-child { font-size: 10.5px; color: var(--rt-text-faint); letter-spacing: .7px; text-transform: uppercase; font-family: "IBM Plex Mono", monospace; margin: 0; }
  .rt-stat p:last-child { font-size: 19px; color: var(--rt-accent); margin-top: 3px; font-family: "IBM Plex Mono", monospace; font-variant-numeric: tabular-nums; }

  .rt-track { height: 10px; border-radius: 5px; background: var(--rt-surface-3); border: 1px solid var(--rt-border); overflow: hidden; margin-top: 10px; }
  .rt-track i { display: block; height: 100%; background: var(--rt-accent); border-radius: 5px; }
  .rt-progrow { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .rt-proglabel { font-size: 14px; font-weight: 600; font-family: "Manrope", sans-serif; margin: 0; color: var(--rt-text); }
  .rt-progval { font-size: 12px; color: var(--rt-accent); margin: 0; }
  .rt-proghelp { font-size: 12px; color: var(--rt-text-dim); margin: 8px 0 0; }

  .rt-lrow {
    display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--rt-border); border-radius: 12px;
    background: var(--rt-surface-2); margin-bottom: 8px; cursor: pointer; width: 100%; text-align: left; color: inherit; font: inherit;
  }
  .rt-lrow.rt-cur { border-color: var(--rt-accent); background: var(--rt-cur-row-bg); }
  .rt-lrow.rt-sel:not(.rt-cur) { border-color: var(--rt-border-strong); }
  .rt-emw img { width: 38px; height: auto; display: block; }
  .rt-nm { flex: 1; min-width: 0; }
  .rt-nm p:first-child { font-size: 14.5px; font-weight: 600; font-family: "Manrope", sans-serif; margin: 0; color: var(--rt-text); }
  .rt-nm p:last-child { font-size: 11.5px; color: var(--rt-text-dim); margin-top: 2px; }
  .rt-th { font-size: 11.5px; color: var(--rt-text-dim); text-align: right; white-space: nowrap; font-family: "IBM Plex Mono", monospace; }
  .rt-lrow.rt-lock .rt-emw img { filter: grayscale(1); opacity: .4; }

  .rt-scene {
    position: relative; overflow: hidden; border-radius: 16px; border: 1px solid var(--rt-border); height: 280px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 12px; background: #0a0f1a;
  }
  .rt-scene .rt-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .72; }
  .rt-scene .rt-fade { position: absolute; left: 0; right: 0; bottom: 0; height: 70px; background: linear-gradient(180deg, rgba(6,10,20,0), rgba(6,10,20,.62)); }
  .rt-scene .rt-top { position: absolute; left: 0; right: 0; top: 0; height: 56px; background: linear-gradient(180deg, rgba(6,10,20,.5), rgba(6,10,20,0)); }
  .rt-fg { position: relative; z-index: 2; text-align: center; padding: 16px; }
  .rt-bignum { font-family: "IBM Plex Mono", monospace; font-size: 90px; font-weight: 700; line-height: 1; color: #fff; text-shadow: 0 2px 26px rgba(0,0,0,.92), 0 0 6px rgba(0,0,0,.8); font-variant-numeric: tabular-nums; margin: 0; }
  .rt-scene .rt-cap { font-size: 12.5px; letter-spacing: 3px; text-transform: uppercase; color: #fff; margin-top: 4px; text-shadow: 0 1px 10px rgba(0,0,0,.95); font-family: "IBM Plex Mono", monospace; }
  .rt-scene .rt-tiertag { position: absolute; top: 12px; left: 12px; z-index: 3; background: rgba(6,20,32,.72); color: #fff; border-color: rgba(255,255,255,.35); }
  .rt-scene .rt-qline { position: absolute; bottom: 12px; left: 0; right: 0; text-align: center; z-index: 3; font-size: 12.5px; color: #fff; text-shadow: 0 1px 8px rgba(0,0,0,.95); margin: 0; }

  .rt-hgrid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
  .rt-hc { background: var(--rt-surface); border: 1px solid var(--rt-border); border-radius: 16px; padding: 14px 10px 12px; text-align: center; position: relative; }
  .rt-hc-live { border-style: dashed; border-color: var(--rt-warn-bd); }
  .rt-hc img { width: 76px; height: auto; margin: 0 auto; }
  .rt-hc .rt-sn { font-size: 10px; color: var(--rt-text-faint); letter-spacing: .6px; margin-top: 6px; font-family: "IBM Plex Mono", monospace; }
  .rt-hc .rt-rn { font-size: 13.5px; font-weight: 700; margin-top: 4px; line-height: 1.2; font-family: "Manrope", sans-serif; color: var(--rt-text); }
  .rt-hc .rt-hv { font-size: 11.5px; color: var(--rt-accent); margin-top: 4px; font-family: "IBM Plex Mono", monospace; }
  .rt-shr { position: absolute; top: 8px; right: 8px; border: 1px solid var(--rt-border); background: var(--rt-surface-3); color: var(--rt-text-dim); width: 26px; height: 26px; border-radius: 8px; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .rt-shr:hover { color: var(--rt-accent); border-color: var(--rt-accent-dim); }
  .rt-bestrow { display: flex; align-items: center; gap: 14px; }

  /* Tarjetas fuera de pantalla, solo para capturarlas como imagen al
     compartir (ver shareImage.js) — ancho fijo, nunca visibles. */
  .rt-share-offscreen { position: fixed; top: 0; left: -10000px; pointer-events: none; }
  .rt-hero-share, .rt-scene-share { width: 420px; min-height: 280px; height: 420px; }
  .rt-share-stat { font-size: 15px; color: var(--rt-accent); margin-top: 8px; }
  .rt-share-brand {
    position: absolute; top: 12px; right: 14px; z-index: 3; font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
    color: rgba(255,255,255,.85); text-shadow: 0 1px 6px rgba(0,0,0,.9); font-family: "IBM Plex Mono", monospace;
  }

  @media (max-width: 480px) {
    .rt-hgrid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
`;
