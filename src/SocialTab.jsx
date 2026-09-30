import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { RANK_NAMES, RANK_QUIPS, APP_URL, hm, wearLabel } from "./domain.js";
import { searchAsignaturasCanonicas } from "./supabaseData.js";
import { OFFLINE_MESSAGE, friendlyError } from "./offline.js";
import * as api from "./socialData.js";
import { USERNAME_RE } from "./socialData.js";
import { CONSENT_VERSION, CONSENT_METRICAS, CONSENT_RANKING, STATS_PRIVACY_NOTE } from "./socialTexts.js";
import { summarizeStudy, buildFriendModel, compareByRank, heatmapCells } from "./friendMetrics.js";

/* ------------------------------------------------------------------ */
/*  Pestaña Social — sección Amigos                                    */
/* ------------------------------------------------------------------ */

// Colores de cada rango (elegidos para que se lean bien en modo claro y oscuro).
const TIER_COLORS = ["#7A8AA6", "#2FB36D", "#1AA5BC", "#D98A0B", "#E8681C", "#8B6DF0", "#E85D93"];

function fmtNum(n, d = 2) {
  return Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/* ---------- piezas visuales ---------- */

// Sello de verificación: estrella ondulada azul con el visto blanco. Solo se
// dibuja si el servidor marca la cuenta como verificada; el nombre de usuario
// no admite símbolos, así que nadie puede imitarlo escribiéndolo.
const BADGE_PATH = (() => {
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * 2 * Math.PI;
    const r = 10.2 + 1.15 * Math.cos(8 * t);
    pts.push(`${(12 + r * Math.cos(t)).toFixed(2)} ${(12 + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
})();

export function VerifiedBadge({ size = 16 }) {
  return (
    <svg className="sc-verified" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Cuenta verificada">
      <title>Cuenta verificada</title>
      <path d={BADGE_PATH} fill="#1D9BF0" />
      <path d="M7.4 12.6l3 3 6.2-6.6" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Username({ name, verified }) {
  return (
    <span className="sc-uname">
      <span className="sc-uname-text">{name}</span>
      {verified && <VerifiedBadge size={16} />}
    </span>
  );
}

const ICONS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  invite: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M19 8v6M16 11h6" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function Flame({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1.5-.7-2.5-1.3-3.5C14.5 9 17 10 17 14a5 5 0 0 1-10 0c0-6 5-7 5-12z" />
    </svg>
  );
}

function RankEmblem({ tier, size }) {
  return (
    <img
      src={`/rangos/rank-badges/badge-${tier}.webp`}
      width={size}
      height={size}
      alt={`Emblema ${RANK_NAMES[tier]}`}
      style={{ filter: "drop-shadow(0 3px 8px rgba(79,216,234,0.25))" }}
    />
  );
}

function SocialModal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          {onClose && <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function OfflineBar() {
  return <div className="sc-offline mono">{OFFLINE_MESSAGE}</div>;
}

function ErrorPanel({ message, onRetry }) {
  const offline = message === OFFLINE_MESSAGE;
  return (
    <div className="panel">
      <div className="panel-title">{offline ? "Sin conexión" : "No se han podido cargar tus datos"}</div>
      <div className="auth-error">{message}</div>
      <div className="btn-row"><button className="btn-primary" onClick={onRetry}>Reintentar</button></div>
    </div>
  );
}

/* ---------- entrada: nombre de usuario y consentimiento ---------- */

function UsernameScreen({ pendingInvite, online, onCreated }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const u = name.trim();
    if (!USERNAME_RE.test(u)) {
      setError("Usa entre 3 y 20 caracteres: letras, números, punto o guion bajo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.crearPerfilSocial(u);
      await onCreated();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-title">Elige tu nombre de usuario</div>
      <p className="panel-subtitle">
        Es el nombre con el que te verán tus amigos en Clever. Entre 3 y 20 caracteres: letras, números, punto o guion bajo.
        No distingue mayúsculas y no puede repetirse.
      </p>
      <input
        className="input-field"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="tu_nombre"
        maxLength={20}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        aria-label="Nombre de usuario"
      />
      {error && <div className="auth-error">{error}</div>}
      {pendingInvite && (
        <p className="panel-subtitle" style={{ marginTop: 10, marginBottom: 0 }}>
          Después te mostraré la invitación de <strong>{pendingInvite}</strong>.
        </p>
      )}
      {!online && <OfflineBar />}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn-primary" type="submit" disabled={busy || !online || name.trim() === ""}>
          {busy ? "Guardando…" : "Continuar"}
        </button>
      </div>
    </form>
  );
}

function ConsentModal({ text, online, onAccept, onDecline }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await onAccept();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <SocialModal title={text.title}>
      <div className="sc-legal">
        {text.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      {error && <div className="auth-error">{error}</div>}
      {!online && <OfflineBar />}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn-primary" onClick={accept} disabled={busy || !online}>{busy ? "Guardando…" : text.accept}</button>
        <button className="btn-ghost" onClick={onDecline} disabled={busy}>{text.decline}</button>
      </div>
    </SocialModal>
  );
}

/* ---------- clasificación ---------- */

function RankRow({ pos, name, verified, summary, isMe, locked, note, onClick }) {
  const tier = summary?.tier ?? 0;
  const color = TIER_COLORS[tier];
  const Tag = locked ? "div" : "button";
  return (
    <Tag
      type={locked ? undefined : "button"}
      className={`sc-row ${isMe ? "sc-me" : ""} ${locked ? "sc-locked" : ""}`}
      style={{ "--rc": color }}
      onClick={locked ? undefined : onClick}
    >
      <span className="sc-pos mono">{pos ?? "–"}</span>
      <span className="sc-who">
        <Username name={name} verified={verified} />
        {isMe && <span className="sc-you mono">TÚ</span>}
        {note && <span className="sc-note mono">{note}</span>}
      </span>
      {summary && (
        <span className="sc-rank">
          <span className="sc-rank-txt">
            <span className="sc-rank-name">{RANK_NAMES[tier]}</span>
            <span className="sc-streak mono"><Flame /> {summary.streak} {summary.streak === 1 ? "día" : "días"}</span>
          </span>
          <RankEmblem tier={tier} size={38} />
        </span>
      )}
    </Tag>
  );
}

/* ---------- búsqueda ---------- */

function SearchView({ amistades, online, onClose, onSent }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState({}); // username -> "sending" | "sent" | mensaje de error
  const seq = useRef(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) { setResults([]); setError(null); setLoading(false); return undefined; }
    const my = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await api.buscarUsuarios(term);
        if (my !== seq.current) return;
        setResults(rows ?? []);
        setError(null);
      } catch (e) {
        if (my === seq.current) { setResults([]); setError(e.message); }
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const relation = useMemo(() => {
    const m = new Map();
    amistades.forEach((a) => m.set(a.username.toLowerCase(), a.estado));
    return m;
  }, [amistades]);

  async function send(username) {
    setSent((s) => ({ ...s, [username]: "sending" }));
    try {
      await api.solicitarAmistad(username);
      setSent((s) => ({ ...s, [username]: "sent" }));
      onSent();
    } catch (e) {
      setSent((s) => ({ ...s, [username]: e.message }));
    }
  }

  return (
    <div className="sc-search">
      <div className="sc-search-bar">
        <span className="sc-search-icon"><Icon name="search" size={18} /></span>
        <input
          ref={inputRef}
          className="input-field sc-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre de usuario"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Buscar usuarios"
        />
        <button className="sc-iconbtn" onClick={onClose} aria-label="Cerrar búsqueda"><Icon name="close" /></button>
      </div>
      {!online && <OfflineBar />}
      {q.trim().length < 3 && <p className="sc-hint">Escribe al menos 3 letras del nombre de usuario.</p>}
      {loading && <p className="sc-hint">Buscando…</p>}
      {error && <div className="auth-error">{error}</div>}
      {!loading && !error && q.trim().length >= 3 && results.length === 0 && (
        <p className="sc-hint">No hay resultados. Comprueba el nombre o invita a tu amigo con el enlace.</p>
      )}
      <div className="sc-list">
        {results.map((r) => {
          const rel = relation.get(r.username.toLowerCase());
          const st = sent[r.username];
          return (
            <div key={r.username} className="sc-row sc-row-static">
              <span className="sc-who"><Username name={r.username} verified={r.verificado} /></span>
              <span className="sc-actions">
                {rel === "aceptada" ? <span className="sc-tag mono">AMIGOS</span>
                  : rel === "pendiente" || st === "sent" ? <span className="sc-tag mono">PENDIENTE</span>
                  : <button className="btn-primary btn-small" onClick={() => send(r.username)} disabled={!online || st === "sending"}>
                      {st === "sending" ? "Enviando…" : "Enviar solicitud"}
                    </button>}
              </span>
              {st && st !== "sending" && st !== "sent" && <span className="sc-rowerr auth-error">{st}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- solicitudes ---------- */

function RequestsView({ amistades, online, busyId, error, onRespond, onCancel, onClose }) {
  const recibidas = amistades.filter((a) => a.estado === "pendiente" && a.direccion === "recibida");
  const enviadas = amistades.filter((a) => a.estado === "pendiente" && a.direccion === "enviada");
  return (
    <div className="sc-search">
      <div className="sc-search-bar">
        <div className="panel-title" style={{ flex: 1, margin: 0 }}>Solicitudes</div>
        <button className="sc-iconbtn" onClick={onClose} aria-label="Cerrar solicitudes"><Icon name="close" /></button>
      </div>
      {!online && <OfflineBar />}
      {error && <div className="auth-error">{error}</div>}
      {recibidas.length === 0 && enviadas.length === 0 && <p className="sc-hint">No tienes solicitudes pendientes.</p>}
      {recibidas.length > 0 && <div className="sc-section-label mono">RECIBIDAS</div>}
      <div className="sc-list">
        {recibidas.map((a) => (
          <div key={a.id} className="sc-row sc-row-static">
            <span className="sc-who"><Username name={a.username} verified={a.verificado} /></span>
            <span className="sc-actions">
              <button className="btn-primary btn-small" disabled={!online || busyId === a.id} onClick={() => onRespond(a.id, true)}>Aceptar</button>
              <button className="btn-ghost btn-small" disabled={!online || busyId === a.id} onClick={() => onRespond(a.id, false)}>Rechazar</button>
            </span>
          </div>
        ))}
      </div>
      {enviadas.length > 0 && <div className="sc-section-label mono">ENVIADAS</div>}
      <div className="sc-list">
        {enviadas.map((a) => (
          <div key={a.id} className="sc-row sc-row-static">
            <span className="sc-who"><Username name={a.username} verified={a.verificado} /></span>
            <span className="sc-actions">
              <span className="sc-tag mono">PENDIENTE</span>
              <button className="btn-ghost btn-small" disabled={!online || busyId === a.id} onClick={() => onCancel(a)}>Cancelar</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- ficha del amigo ---------- */

function Heatmap({ dailyTotals, weeks }) {
  const cols = useMemo(() => heatmapCells(dailyTotals, weeks), [dailyTotals, weeks]);
  const level = (m) => (m == null ? -1 : m <= 0 ? 0 : m < 30 ? 1 : m < 90 ? 2 : m < 180 ? 3 : 4);
  return (
    <div className="sc-hm" role="img" aria-label={`Mapa de calor de estudio de las últimas ${weeks} semanas`}>
      {cols.map((col, i) => (
        <div key={i} className="sc-hm-col">
          {col.map((c) => (
            <div key={c.date} className="sc-hm-cell" data-l={level(c.minutes)} title={c.minutes == null ? "" : `${c.date}: ${hm(c.minutes)}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function StatCardSc({ label, value, hint, onClick, active }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`sc-stat ${onClick ? "sc-stat-btn" : ""} ${active ? "sc-stat-active" : ""}`} onClick={onClick}>
      <span className="sc-stat-label mono">{label}</span>
      <span className="sc-stat-value">{value}</span>
      {hint && <span className="sc-stat-hint">{hint}</span>}
    </Tag>
  );
}

function FriendSheet({ model, own, isMobile, online, onBack, onRemove, onBlock }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // "remove" | "block"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showSubjects, setShowSubjects] = useState(false);
  const color = TIER_COLORS[model.tier];
  const past = model.history.filter((h) => !h.isCurrent);

  async function doConfirm() {
    setBusy(true);
    setError(null);
    try {
      await (confirm === "remove" ? onRemove() : onBlock());
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const rows = [
    ["Rango", RANK_NAMES[own.tier], RANK_NAMES[model.tier]],
    ["h/crédito (season)", fmtNum(own.hpcSeason), fmtNum(model.hpcSeason)],
    ["Racha actual", `${own.streak} d`, `${model.streak} d`],
  ];

  return (
    <div className="sc-ficha">
      <div className="sc-ficha-top">
        <button className="sc-iconbtn" onClick={onBack} aria-label="Volver a la clasificación"><Icon name="back" /></button>
        <div className="sc-ficha-name"><Username name={model.username} verified={model.verified} /></div>
        <div className="sc-menu-wrap">
          <button className="sc-iconbtn" onClick={() => setMenuOpen((v) => !v)} aria-label="Más opciones" aria-expanded={menuOpen}><Icon name="more" /></button>
          {menuOpen && (
            <div className="account-dropdown sc-dropdown">
              <button className="account-dropdown-row" onClick={() => { setMenuOpen(false); setConfirm("remove"); }}>Quitar amigo</button>
              <button className="account-dropdown-row" onClick={() => { setMenuOpen(false); setConfirm("block"); }}>Bloquear</button>
            </div>
          )}
        </div>
      </div>

      <div className="panel sc-hero" style={{ "--rc": color }}>
        <RankEmblem tier={model.tier} size={isMobile ? 104 : 120} />
        <div className="sc-hero-rank">{RANK_NAMES[model.tier]}</div>
        <div className="sc-hero-quip">{RANK_QUIPS[model.tier]}</div>
        <div className="sc-hero-streak mono">
          <Flame size={15} /> {model.streak} {model.streak === 1 ? "día" : "días"} de racha
          {model.bestStreak > model.streak && <span className="sc-dim"> · mejor: {model.bestStreak}</span>}
        </div>
        <div className="sc-hero-season mono">{model.season.label.toUpperCase()}</div>
      </div>

      <div className="sc-cards">
        <StatCardSc label="H/CRÉDITO" value={model.hpcTotal == null ? "—" : fmtNum(model.hpcTotal)} hint="acumuladas (aprobadas)" />
        <StatCardSc label="MINUTOS TOTALES" value={hm(model.totalMinutes)} hint={`${model.totalMinutes.toLocaleString("es-ES")} min`} />
        <StatCardSc
          label="ASIGNATURAS" value={model.numSubjects} hint={showSubjects ? "ocultar desglose" : "ver desglose"}
          onClick={() => setShowSubjects((v) => !v)} active={showSubjects}
        />
        <StatCardSc label="ESTA SEMANA" value={hm(model.weekMinutes)} hint="últimos 7 días" />
      </div>

      {showSubjects && (
        <div className="panel sc-breakdown">
          {model.subjects.length === 0 && <div className="empty-hint">Aún no tiene asignaturas.</div>}
          {model.subjects.map((s) => (
            <div key={s.id} className="sc-brow">
              <span className="sc-bdot" style={{ background: s.color || "var(--cyan)" }} />
              <span className="sc-bname">{s.name}</span>
              <span className="sc-bval mono">
                {s.estado === "aprobada" && s.hpc != null ? `${fmtNum(s.hpc)} h/cr` : hm(s.minutos || 0)}
                {s.estado === "aprobada" && model.showGrades && s.nota != null ? ` · nota ${fmtNum(s.nota, 1)}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="panel-title">Tú vs {model.username}</div>
        <div className="sc-vs">
          <span />
          <span className="sc-vs-h mono">TÚ</span>
          <span className="sc-vs-h mono">AMIGO</span>
          {rows.map(([label, a, b]) => (
            <React.Fragment key={label}>
              <span className="sc-vs-l">{label}</span>
              <span className="sc-vs-v">{a}</span>
              <span className="sc-vs-v">{b}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Estudio de las últimas semanas</div>
        <Heatmap dailyTotals={model.dailyTotals} weeks={isMobile ? 12 : 20} />
        <div className="sc-hm-legend mono"><span>menos</span>{[0, 1, 2, 3, 4].map((l) => <span key={l} className="sc-hm-cell" data-l={l} />)}<span>más</span></div>
      </div>

      {past.length > 0 && (
        <div className="panel">
          <div className="panel-title">Emblemas de seasons anteriores</div>
          <div className="sc-emblems">
            {past.map((h) => (
              <div key={h.season.id} className="sc-emblem">
                <RankEmblem tier={h.tier} size={54} />
                <span className="sc-emblem-label mono">{h.season.label.replace("Season ", "S")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirm && (
        <SocialModal title={confirm === "remove" ? "Quitar amigo" : "Bloquear"} onClose={busy ? undefined : () => setConfirm(null)}>
          <p className="panel-subtitle">
            {confirm === "remove"
              ? `¿Quitar a ${model.username} de tus amigos? Dejaréis de veros. Podréis volver a enviaros una solicitud.`
              : `¿Bloquear a ${model.username}? Dejará de aparecer en tus búsquedas y no podrá enviarte solicitudes. Puedes desbloquearlo desde Ajustes.`}
          </p>
          {error && <div className="auth-error">{error}</div>}
          <div className="btn-row">
            <button className="btn-primary btn-danger" onClick={doConfirm} disabled={busy || !online}>
              {busy ? "Un momento…" : confirm === "remove" ? "Quitar amigo" : "Bloquear"}
            </button>
            <button className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancelar</button>
          </div>
        </SocialModal>
      )}
    </div>
  );
}

/* ---------- invitación recibida por enlace ---------- */

function InviteModal({ from, online, onClose }) {
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState(null);
  async function send() {
    setState("sending");
    try {
      await api.solicitarAmistad(from);
      setState("sent");
    } catch (e) {
      setError(e.message);
      setState("error");
    }
  }
  return (
    <SocialModal title="Te han invitado a Clever" onClose={onClose}>
      {state === "sent" ? (
        <p className="panel-subtitle">Solicitud enviada. Cuando <strong>{from}</strong> la acepte, aparecerá en tu clasificación de amigos.</p>
      ) : (
        <p className="panel-subtitle"><strong>{from}</strong> te ha invitado a ser su amigo en Clever. ¿Le envías una solicitud de amistad?</p>
      )}
      {error && <div className="auth-error">{error}</div>}
      {!online && <OfflineBar />}
      <div className="btn-row">
        {state !== "sent" && state !== "error" && (
          <button className="btn-primary" onClick={send} disabled={!online || state === "sending"}>
            {state === "sending" ? "Enviando…" : "Enviar solicitud"}
          </button>
        )}
        <button className="btn-ghost" onClick={onClose}>{state === "sent" || state === "error" ? "Cerrar" : "Ahora no"}</button>
      </div>
    </SocialModal>
  );
}

/* ---------- sección Amigos ---------- */

function AmigosSection({ perfil, subjects, entries, logs, pendingInvite, onInviteHandled, isMobile, online, onNeedConsent }) {
  const [amistades, setAmistades] = useState([]);
  const [models, setModels] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("ranking"); // ranking | search | requests | ficha
  const [fichaUser, setFichaUser] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [reqError, setReqError] = useState(null);
  const [shareMsg, setShareMsg] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(Boolean(pendingInvite) && pendingInvite.toLowerCase() !== perfil.username.toLowerCase());

  const own = useMemo(() => summarizeStudy(subjects, entries, logs), [subjects, entries, logs]);

  // Un ciclo de carga por vez: si se pide otra, la anterior se descarta.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const my = ++loadSeq.current;
    setError(null);
    try {
      const list = (await api.misAmistades()) ?? [];
      if (my !== loadSeq.current) return;
      setAmistades(list);
      const accepted = list.filter((a) => a.estado === "aceptada");
      let needConsent = false;
      const pairs = await mapLimit(accepted, 4, async (a) => {
        try {
          return [a.username, { state: "ok", model: buildFriendModel(await api.resumenAmigo(a.username)), verified: a.verificado }];
        } catch (e) {
          if (e.code === "consentimiento_propio_requerido") needConsent = true;
          if (e.code === "no_disponible") return [a.username, { state: "noaccess", verified: a.verificado }];
          return [a.username, { state: "error", message: e.message, verified: a.verificado }];
        }
      });
      if (my !== loadSeq.current) return;
      if (needConsent) { onNeedConsent(); return; }
      setModels(Object.fromEntries(pairs));
    } catch (e) {
      if (my === loadSeq.current) setError(e.message);
    } finally {
      if (my === loadSeq.current) setLoading(false);
    }
  }, [onNeedConsent]);

  useEffect(() => { load(); return () => { loadSeq.current++; }; }, [load]);

  const recibidas = amistades.filter((a) => a.estado === "pendiente" && a.direccion === "recibida");

  const ranking = useMemo(() => {
    const ok = [{ username: perfil.username, verified: perfil.verificado, summary: own, me: true }];
    const locked = [];
    amistades.filter((a) => a.estado === "aceptada").forEach((a) => {
      const m = models[a.username];
      if (m?.state === "ok") ok.push({ username: a.username, verified: m.model.verified, summary: m.model, me: false });
      else if (m) locked.push({ username: a.username, verified: a.verificado, state: m.state, message: m.message });
      else locked.push({ username: a.username, verified: a.verificado, state: "loading" });
    });
    ok.sort((a, b) => compareByRank(a.summary, b.summary));
    return { ok, locked };
  }, [amistades, models, own, perfil.username, perfil.verificado]);

  async function respond(id, acepta) {
    setBusyId(id);
    setReqError(null);
    try {
      await api.responderSolicitud(id, acepta);
      await load();
    } catch (e) {
      setReqError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(a) {
    setBusyId(a.id);
    setReqError(null);
    try {
      await api.quitarAmistad(a.username);
      await load();
    } catch (e) {
      setReqError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function shareInvite() {
    const link = `${APP_URL}/?invitar=${encodeURIComponent(perfil.username)}`;
    const text = `Te invito a Clever, la bitácora de estudio. Únete y seremos amigos: ${link}`;
    setShareMsg(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Clever", text, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setShareMsg("Enlace de invitación copiado.");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      setShareMsg(`No se pudo copiar el enlace. Cópialo a mano: ${link}`);
    }
  }

  function closeInvite() {
    setInviteOpen(false);
    onInviteHandled();
    load();
  }

  if (loading && amistades.length === 0 && !error) return <div className="sc-hint">Cargando amigos…</div>;
  if (error && amistades.length === 0) return <ErrorPanel message={error} onRetry={() => { setLoading(true); load(); }} />;

  const fichaModel = fichaUser && models[fichaUser]?.state === "ok" ? models[fichaUser].model : null;

  return (
    <>
      {!online && <OfflineBar />}
      {error && <div className="auth-error">{error}</div>}

      {view === "ficha" && fichaModel && (
        <FriendSheet
          model={fichaModel}
          own={own}
          isMobile={isMobile}
          online={online}
          onBack={() => setView("ranking")}
          onRemove={async () => { await api.quitarAmistad(fichaModel.username); setView("ranking"); await load(); }}
          onBlock={async () => { await api.bloquearUsuario(fichaModel.username); setView("ranking"); await load(); }}
        />
      )}

      {view === "search" && (
        <SearchView amistades={amistades} online={online} onClose={() => setView("ranking")} onSent={load} />
      )}

      {view === "requests" && (
        <RequestsView
          amistades={amistades} online={online} busyId={busyId} error={reqError}
          onRespond={respond} onCancel={cancel} onClose={() => setView("ranking")}
        />
      )}

      {view === "ranking" && (
        <>
          <div className="sc-toolbar">
            <div className="panel-title" style={{ margin: 0, flex: 1 }}>Clasificación de amigos</div>
            <button className="sc-iconbtn" onClick={() => setView("search")} aria-label="Buscar usuarios"><Icon name="search" /></button>
            <button className="sc-iconbtn" onClick={() => { setReqError(null); setView("requests"); }} aria-label={`Solicitudes${recibidas.length ? `, ${recibidas.length} pendientes` : ""}`}>
              <Icon name="bell" />
              {recibidas.length > 0 && <span className="sc-count mono">{recibidas.length}</span>}
            </button>
            <button className="sc-iconbtn" onClick={shareInvite} aria-label="Invitar a un amigo a Clever"><Icon name="invite" /></button>
          </div>
          {shareMsg && <div className="sc-hint">{shareMsg}</div>}

          <div className="sc-list">
            {ranking.ok.map((r, i) => (
              <RankRow
                key={r.username} pos={i + 1} name={r.username} verified={r.verified} summary={r.summary} isMe={r.me}
                onClick={r.me ? undefined : () => { setFichaUser(r.username); setView("ficha"); }}
                locked={r.me}
              />
            ))}
            {ranking.locked.map((r) => (
              <RankRow
                key={r.username} name={r.username} verified={r.verified} locked
                note={r.state === "noaccess" ? "no comparte sus datos" : r.state === "loading" ? "cargando…" : "no se pudo cargar"}
              />
            ))}
          </div>

          {ranking.ok.length + ranking.locked.length === 1 && (
            <div className="panel sc-empty">
              <div className="panel-title">Aún no tienes amigos</div>
              <p className="panel-subtitle" style={{ marginBottom: 12 }}>Añade a tu primer amigo con la lupa o comparte el enlace.</p>
              <div className="btn-row" style={{ justifyContent: "center" }}>
                <button className="btn-primary" onClick={() => setView("search")}>Buscar amigos</button>
                <button className="btn-ghost" onClick={shareInvite}>Invitar por enlace</button>
              </div>
            </div>
          )}
        </>
      )}

      {inviteOpen && <InviteModal from={pendingInvite} online={online} onClose={closeInvite} />}
    </>
  );
}


/* ---------- sección Guía (estadísticas de la comunidad) ---------- */

const SMALL_SAMPLE = 5; // por debajo de este nº de aprobados se avisa de que la muestra es pequeña
const rankingAskedKey = (userId) => `clever:social:ranking-preguntado:${userId}`;

function plural(n, one, many) { return n === 1 ? one : many; }

function StatsBlock({ stats }) {
  if (stats.excluida) {
    return (
      <div className="panel">
        <div className="panel-title">Esta asignatura no entra en las estadísticas</div>
        <p className="panel-subtitle" style={{ marginBottom: 0 }}>
          Las asignaturas de Erasmus y las marcadas como «sin créditos» no se incluyen, porque no se pueden comparar en horas por crédito.
        </p>
      </div>
    );
  }
  if (!stats.suficiente) {
    return (
      <div className="panel sc-empty">
        <div className="panel-title">Basado en {stats.n} {plural(stats.n, "aprobado", "aprobados")}</div>
        <p className="panel-subtitle" style={{ marginBottom: 0 }}>
          Todavía faltan datos para mostrar estadísticas de esta asignatura. Cuantos más alumnos la aprueben, más fiables serán.
        </p>
      </div>
    );
  }
  const n = stats.n;
  return (
    <>
      <div className="panel">
        <div className="panel-title">Basado en {n} {plural(n, "aprobado", "aprobados")}</div>
        {n < SMALL_SAMPLE && (
          <div className="sc-warn">La muestra es pequeña: tómalo como una orientación, no como una cifra firme.</div>
        )}
        <ul className="sc-facts">
          <li>De media, los aprobados estudiaron <strong>{fmtNum(stats.horas_por_credito_media)} h/crédito</strong> ({hm(stats.minutos_medios)} en total).</li>
          {stats.horas_por_credito_q1 != null && (
            <li>La mitad de los aprobados estudió entre <strong>{fmtNum(stats.horas_por_credito_q1)}</strong> y <strong>{fmtNum(stats.horas_por_credito_q3)} h/crédito</strong>.</li>
          )}
          {stats.pct_aprobado_primera != null && (
            <li>El <strong>{fmtNum(stats.pct_aprobado_primera, 0)}%</strong> aprobó a la primera{stats.cursos_necesarios_medio != null ? <>; se necesitaron de media <strong>{fmtNum(stats.cursos_necesarios_medio)}</strong> cursos</> : null}.</li>
          )}
          {stats.desgaste_medio != null && (
            <li>Desgaste medio: <strong>{fmtNum(stats.desgaste_medio)}/10</strong> ({wearLabel(stats.desgaste_medio)}).</li>
          )}
        </ul>
      </div>

      <div className="panel">
        <div className="panel-title">Por tramo de nota</div>
        <div className="sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr><th>Nota</th><th>Aprobados</th><th>H/crédito</th><th>A la 1.ª</th></tr>
            </thead>
            <tbody>
              {stats.tramos.map((t) => (
                <tr key={t.tramo}>
                  <td className="mono">{t.tramo.replace("-", " a ").replace(".", ",").replace("9+", "9 o más")}</td>
                  <td>{t.n}</td>
                  <td>{t.horas_por_credito_media == null ? "—" : fmtNum(t.horas_por_credito_media)}</td>
                  <td>{t.pct_aprobado_primera == null ? "—" : `${fmtNum(t.pct_aprobado_primera, 0)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function GuiaSection({ userId, perfil, carreraId, subjects, online, onGoAmigos, onOpenSettings, reloadPerfil }) {
  const [catalog, setCatalog] = useState(null);
  const [catError, setCatError] = useState(null);
  const [selected, setSelected] = useState("");
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [rows, setRows] = useState(null);
  const [rowsError, setRowsError] = useState(null);
  const [askRanking, setAskRanking] = useState(false);
  const [asked, setAsked] = useState(() => {
    try { return window.localStorage.getItem(rankingAskedKey(userId)) === "1"; } catch { return false; }
  });

  const loadCatalog = useCallback(async () => {
    if (!carreraId) return;
    setCatError(null);
    try {
      const rowsCat = await searchAsignaturasCanonicas(carreraId, "", { limit: 400 });
      setCatalog(rowsCat ?? []);
    } catch (e) {
      setCatError(friendlyError(e));
    }
  }, [carreraId]);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const approvedIds = useMemo(
    () => new Set(subjects.filter((s) => s.estado === "aprobada" && s.asignaturaCanonicaId).map((s) => s.asignaturaCanonicaId)),
    [subjects]
  );

  const groups = useMemo(() => {
    if (!catalog) return [];
    const mine = catalog.filter((c) => approvedIds.has(c.id));
    const rest = catalog.filter((c) => !approvedIds.has(c.id));
    const byYear = new Map();
    rest.forEach((c) => {
      const key = c.anio ? `${c.anio}.º curso` : "Otras";
      if (!byYear.has(key)) byYear.set(key, []);
      byYear.get(key).push(c);
    });
    const out = [];
    if (mine.length) out.push({ label: "Tus aprobadas", items: mine });
    [...byYear.entries()].sort(([a], [b]) => a.localeCompare(b, "es")).forEach(([label, items]) => out.push({ label, items }));
    return out;
  }, [catalog, approvedIds]);

  // Por defecto, la primera asignatura aprobada del usuario.
  const defaulted = useRef(false);
  useEffect(() => {
    if (defaulted.current || !catalog) return;
    defaulted.current = true;
    const first = catalog.find((c) => approvedIds.has(c.id));
    if (first) setSelected(first.id);
  }, [catalog, approvedIds]);

  useEffect(() => {
    if (!selected) { setStats(null); return undefined; }
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(null);
    api.comunidadStats(selected)
      .then((r) => { if (!cancelled) setStats(r); })
      .catch((e) => { if (!cancelled) { setStats(null); setStatsError(e.message); } })
      .finally(() => { if (!cancelled) setStatsLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const rankingOk = perfil?.share_ranking_ok === true;
  useEffect(() => {
    if (!selected || !rankingOk) { setRows(null); return undefined; }
    let cancelled = false;
    setRowsError(null);
    api.listadoAprobados(selected)
      .then((r) => { if (!cancelled) setRows(r ?? []); })
      .catch((e) => { if (!cancelled) { setRows(null); setRowsError(e.message); } });
    return () => { cancelled = true; };
  }, [selected, rankingOk]);

  // Pregunta por el listado una sola vez (solo si ya tiene nombre de usuario).
  useEffect(() => {
    if (perfil && !perfil.share_ranking_ok && !asked) setAskRanking(true);
  }, [perfil, asked]);

  function markAsked() {
    try { window.localStorage.setItem(rankingAskedKey(userId), "1"); } catch { /* nada */ }
    setAsked(true);
    setAskRanking(false);
  }
  async function acceptRanking() {
    await api.setConsentimiento("ranking", true, CONSENT_VERSION);
    markAsked();
    await reloadPerfil();
  }

  if (!carreraId) {
    return <div className="panel"><p className="panel-subtitle" style={{ marginBottom: 0 }}>Completa tu carrera en tu perfil para ver las estadísticas de tus asignaturas.</p></div>;
  }
  if (catError) return <ErrorPanel message={catError} onRetry={loadCatalog} />;
  if (!catalog) return <div className="sc-hint">Cargando asignaturas…</div>;

  return (
    <>
      {!online && <OfflineBar />}
      <div className="panel">
        <label className="panel-title" htmlFor="sc-guia-select">Asignatura</label>
        <select id="sc-guia-select" className="input-field" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Elige una asignatura…</option>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((c) => <option key={c.id} value={c.id}>{c.nombre_oficial}</option>)}
            </optgroup>
          ))}
        </select>
        <p className="sc-hint" style={{ margin: "10px 0 0" }}>Solo cuentan alumnos que han aprobado la asignatura.</p>
      </div>

      {statsLoading && <div className="sc-hint">Cargando estadísticas…</div>}
      {statsError && <div className="auth-error">{statsError}</div>}
      {stats && !statsLoading && <StatsBlock stats={stats} />}

      {selected && (
        <div className="panel">
          <div className="panel-title">Listado de aprobados</div>
          {rankingOk ? (
            <>
              {rowsError && <div className="auth-error">{rowsError}</div>}
              {rows && rows.length === 0 && <p className="sc-hint" style={{ margin: 0 }}>Todavía nadie que haya aceptado aparecer ha aprobado esta asignatura.</p>}
              {rows && rows.length > 0 && (
                <div className="sc-table-wrap">
                  <table className="sc-table">
                    <thead>
                      <tr><th>Usuario</th><th>H/cr</th><th>Nota</th><th>Desgaste</th><th>Cursos</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.username} className={r.username.toLowerCase() === perfil.username.toLowerCase() ? "sc-tr-me" : ""}>
                          <td><Username name={r.username} verified={r.verificado} /></td>
                          <td>{fmtNum(r.horas_por_credito)}</td>
                          <td>{r.nota == null ? "—" : fmtNum(r.nota, 1)}</td>
                          <td>{r.desgaste_maximo == null ? "—" : fmtNum(r.desgaste_maximo)}</td>
                          <td>{r.cursos_necesarios ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : perfil === null ? (
            <>
              <p className="panel-subtitle">Para aparecer en el listado y verlo, primero elige tu nombre de usuario.</p>
              <button className="btn-ghost btn-small" onClick={onGoAmigos}>Elegir nombre de usuario</button>
            </>
          ) : (
            <>
              <p className="panel-subtitle">Solo lo ven quienes han aceptado aparecer en él. Puedes activarlo cuando quieras en Ajustes de Social.</p>
              <button className="btn-ghost btn-small" onClick={onOpenSettings}>Abrir ajustes de Social</button>
            </>
          )}
        </div>
      )}

      <p className="sc-hint sc-legal-note">{STATS_PRIVACY_NOTE}</p>

      {askRanking && perfil && (
        <ConsentModal text={CONSENT_RANKING} online={online} onAccept={acceptRanking} onDecline={markAsked} />
      )}
    </>
  );
}

/* ---------- ajustes de Social ---------- */

function SettingSwitch({ label, hint, on, disabled, onChange }) {
  return (
    <div className="sc-setting">
      <div className="sc-setting-txt">
        <div className="sc-setting-label">{label}</div>
        {hint && <div className="sc-setting-hint">{hint}</div>}
      </div>
      <button
        type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
        className={`switch ${on ? "switch-on" : ""}`} onClick={() => onChange(!on)}
      ><span className="switch-knob" /></button>
    </div>
  );
}

export function SocialSettingsModal({ userId, onClose }) {
  const online = useOnline();
  const [perfil, setPerfil] = useState(undefined);
  const [blocked, setBlocked] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameMsg, setNameMsg] = useState(null);
  const [consentFor, setConsentFor] = useState(null); // "metricas" | "ranking"

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await api.getMiPerfilSocial(userId);
      setPerfil(p);
      setNewName(p?.username ?? "");
      if (p) setBlocked(((await api.misAmistades()) ?? []).filter((a) => a.estado === "bloqueada"));
    } catch (e) {
      setError(e.message);
    }
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleConsent(tipo, next) {
    if (next) { setConsentFor(tipo); return; }
    run(() => api.setConsentimiento(tipo, false));
  }

  async function saveName() {
    const u = newName.trim();
    setNameMsg(null);
    if (u === perfil.username) return;
    if (!USERNAME_RE.test(u)) { setNameMsg({ type: "error", text: "Usa entre 3 y 20 caracteres: letras, números, punto o guion bajo." }); return; }
    setBusy(true);
    try {
      await api.cambiarUsername(u);
      setNameMsg({ type: "ok", text: "Nombre de usuario actualizado." });
      await load();
    } catch (e) {
      setNameMsg({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SocialModal title="Ajustes de Social" onClose={onClose}>
      {perfil === undefined && !error && <div className="sc-hint">Cargando…</div>}
      {error && <div className="auth-error">{error}</div>}
      {!online && <OfflineBar />}
      {perfil === null && (
        <p className="panel-subtitle" style={{ marginBottom: 0 }}>Aún no tienes perfil social. Entra en la pestaña Social para elegir tu nombre de usuario.</p>
      )}
      {perfil && (
        <div className="sc-settings">
          <div className="sc-setting-block">
            <div className="sc-setting-label">Nombre de usuario {perfil.verificado && <VerifiedBadge size={15} />}</div>
            <div className="sc-name-edit">
              <input
                className="input-field" value={newName} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={(e) => setNewName(e.target.value)} aria-label="Nombre de usuario"
              />
              <button className="btn-primary btn-small" onClick={saveName} disabled={busy || !online || newName.trim() === perfil.username}>Cambiar</button>
            </div>
            {nameMsg && <div className={nameMsg.type === "error" ? "auth-error" : "sc-ok"}>{nameMsg.text}</div>}
          </div>

          <SettingSwitch
            label="Compartir mis métricas con amigos"
            hint="Tus amigos aceptados ven tu rango, racha y métricas. Si lo desactivas, dejan de verte al instante y se te volverá a preguntar al entrar en Amigos."
            on={perfil.share_metrics_ok} disabled={busy || !online} onChange={(v) => toggleConsent("metricas", v)}
          />
          <SettingSwitch
            label="Aparecer en el listado de aprobados"
            hint="Apareces, con tu nombre de usuario, en el listado de las asignaturas que has aprobado."
            on={perfil.share_ranking_ok} disabled={busy || !online} onChange={(v) => toggleConsent("ranking", v)}
          />
          <SettingSwitch
            label="Mostrar mis notas a mis amigos"
            hint="Solo se ven si además compartes tus métricas."
            on={perfil.show_grades} disabled={busy || !online} onChange={(v) => run(() => api.setMostrarNotas(v))}
          />

          <div className="sc-setting-block">
            <div className="sc-setting-label">Usuarios bloqueados</div>
            {blocked.length === 0 && <div className="sc-setting-hint">No has bloqueado a nadie.</div>}
            {blocked.map((b) => (
              <div key={b.id} className="sc-blocked">
                <Username name={b.username} verified={b.verificado} />
                <button className="btn-ghost btn-small" disabled={busy || !online} onClick={() => run(() => api.desbloquearUsuario(b.username))}>Desbloquear</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {consentFor && (
        <ConsentModal
          text={consentFor === "metricas" ? CONSENT_METRICAS : CONSENT_RANKING}
          online={online}
          onAccept={async () => { await api.setConsentimiento(consentFor, true, CONSENT_VERSION); setConsentFor(null); await load(); }}
          onDecline={() => setConsentFor(null)}
        />
      )}
    </SocialModal>
  );
}

/* ---------- pestaña ---------- */

export default function SocialTab({ userId, carreraId, subjects, entries, logs, pendingInvite, onInviteHandled, onBack, onLeave, onOpenSettings, isMobile }) {
  const online = useOnline();
  const [perfil, setPerfil] = useState(undefined); // undefined = cargando, null = sin perfil
  const [loadError, setLoadError] = useState(null);
  const [section, setSection] = useState("amigos");

  const loadPerfil = useCallback(async () => {
    setLoadError(null);
    try {
      setPerfil(await api.getMiPerfilSocial(userId));
    } catch (e) {
      setLoadError(e.message);
    }
  }, [userId]);

  useEffect(() => { loadPerfil(); }, [loadPerfil]);

  async function acceptMetrics() {
    await api.setConsentimiento("metricas", true, CONSENT_VERSION);
    await loadPerfil();
  }

  let body;
  if (section === "guia") {
    body = (
      <GuiaSection
        userId={userId} perfil={loadError ? undefined : perfil} carreraId={carreraId} subjects={subjects} online={online}
        onGoAmigos={() => setSection("amigos")} onOpenSettings={onOpenSettings} reloadPerfil={loadPerfil}
      />
    );
  } else if (loadError) {
    body = <ErrorPanel message={loadError} onRetry={loadPerfil} />;
  } else if (perfil === undefined) {
    body = <div className="sc-hint">Cargando…</div>;
  } else if (perfil === null) {
    body = <UsernameScreen pendingInvite={pendingInvite} online={online} onCreated={loadPerfil} />;
  } else if (!perfil.share_metrics_ok) {
    body = (
      <ConsentModal text={CONSENT_METRICAS} online={online} onAccept={acceptMetrics} onDecline={onLeave} />
    );
  } else {
    body = (
      <AmigosSection
        perfil={perfil} subjects={subjects} entries={entries} logs={logs}
        pendingInvite={pendingInvite} onInviteHandled={onInviteHandled}
        isMobile={isMobile} online={online} onNeedConsent={loadPerfil}
      />
    );
  }

  return (
    <div className="sc-wrap">
      <div className="sc-head">
        {onBack && (
          <button className="sc-iconbtn sc-backbtn" onClick={onBack} aria-label="Volver a Más"><Icon name="back" size={22} /></button>
        )}
        <h2 className="sc-title">Social</h2>
      </div>
      <div className="sc-seg">
        <button className={`tab-btn ${section === "amigos" ? "tab-btn-active" : ""}`} onClick={() => setSection("amigos")}>Amigos</button>
        <button className={`tab-btn ${section === "guia" ? "tab-btn-active" : ""}`} onClick={() => setSection("guia")}>Guía</button>
      </div>
      {body}
    </div>
  );
}

export const SOCIAL_CSS = `
  .sc-wrap { display: flex; flex-direction: column; gap: 14px; max-width: 640px; }
  .sc-head { display: flex; align-items: center; gap: 12px; }
  .sc-title { flex: 1; margin: 0; font-size: 26px; font-weight: 700; }
  .sc-backbtn { margin-left: -10px; }
  .sc-seg { display: flex; gap: 6px; }
  .sc-hint { color: var(--text-dim); font-size: 13px; line-height: 1.5; }
  .sc-offline { color: var(--amber); font-size: 12px; letter-spacing: 0.04em; margin: 6px 0; }
  .sc-empty { text-align: center; }
  .sc-legal p { font-size: 13px; line-height: 1.55; color: var(--text); margin: 0 0 10px; }
  .sc-dim { color: var(--text-dim); }
  .sc-verified { flex: none; }

  .sc-iconbtn {
    position: relative; width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center;
    background: transparent; border: 1px solid transparent; border-radius: 10px; color: var(--text-dim); cursor: pointer;
  }
  .sc-iconbtn:hover { color: var(--cyan-text); border-color: var(--border); }
  .sc-count {
    position: absolute; top: 2px; right: 0; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px;
    background: var(--red); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
  }
  .sc-toolbar { display: flex; align-items: center; gap: 2px; }

  .sc-uname { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
  .sc-uname-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .sc-list { display: flex; flex-direction: column; gap: 8px; }
  .sc-row {
    display: grid; grid-template-columns: 26px 1fr auto; align-items: center; column-gap: 10px; width: 100%;
    text-align: left; background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
    padding: 10px 12px; color: var(--text); font: inherit; cursor: pointer;
  }
  button.sc-row:hover { border-color: var(--cyan); }
  .sc-row.sc-me { border-color: var(--cyan); background: var(--panel-2); cursor: default; }
  .sc-row.sc-locked:not(.sc-me) { cursor: default; opacity: 0.7; }
  .sc-row-static { cursor: default; grid-template-columns: 1fr auto; }
  .sc-rowerr { grid-column: 1 / -1; margin: 4px 0 0; }
  .sc-pos { font-size: 13px; color: var(--text-dim); text-align: center; }
  .sc-who { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; font-weight: 600; font-size: 15px; }
  .sc-you { font-size: 9px; letter-spacing: 0.14em; color: var(--cyan-text); border: 1px solid var(--cyan); border-radius: 999px; padding: 1px 6px; font-weight: 600; }
  .sc-note { font-size: 10px; color: var(--text-dim); font-weight: 400; }
  .sc-rank { display: flex; align-items: center; gap: 8px; }
  .sc-rank-txt { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; min-width: 0; }
  .sc-rank-name { font-size: 12px; font-weight: 700; color: var(--rc); line-height: 1.2; text-align: right; max-width: 132px; }
  .sc-streak { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--amber); }
  .sc-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .sc-tag { font-size: 10px; letter-spacing: 0.12em; color: var(--text-dim); border: 1px solid var(--border); border-radius: 999px; padding: 3px 8px; }
  .sc-section-label { font-size: 10px; letter-spacing: 0.16em; color: var(--text-dim); margin-top: 6px; }

  .sc-search { display: flex; flex-direction: column; gap: 10px; }
  .sc-search-bar { display: flex; align-items: center; gap: 6px; position: relative; }
  .sc-search-icon { position: absolute; left: 12px; color: var(--text-dim); display: flex; pointer-events: none; }
  .sc-search .sc-search-input { padding-left: 38px; height: 42px; font-size: 14px; }

  .sc-ficha { display: flex; flex-direction: column; gap: 14px; }
  .sc-ficha .panel { margin-bottom: 0; }
  .sc-ficha-top { display: flex; align-items: center; gap: 8px; }
  .sc-ficha-name { flex: 1; font-size: 20px; font-weight: 700; min-width: 0; }
  .sc-menu-wrap { position: relative; }
  .sc-dropdown { right: 0; top: 44px; }
  .sc-hero { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 22px 16px; }
  .sc-hero-rank { font-size: 20px; font-weight: 800; color: var(--rc); }
  .sc-hero-quip { font-size: 13px; color: var(--text-dim); }
  .sc-hero-streak { display: inline-flex; align-items: center; gap: 5px; margin-top: 4px; font-size: 13px; color: var(--amber); }
  .sc-hero-season { font-size: 10px; letter-spacing: 0.18em; color: var(--text-dim); margin-top: 2px; }

  .sc-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sc-stat {
    display: flex; flex-direction: column; gap: 4px; text-align: left; background: var(--panel); border: 1px solid var(--border);
    border-radius: 12px; padding: 12px; color: var(--text); font: inherit;
  }
  .sc-stat-btn { cursor: pointer; }
  .sc-stat-btn:hover, .sc-stat-active { border-color: var(--cyan); }
  .sc-stat-label { font-size: 10px; letter-spacing: 0.14em; color: var(--text-dim); }
  .sc-stat-value { font-size: 24px; font-weight: 700; color: var(--cyan-text); line-height: 1.1; }
  .sc-stat-hint { font-size: 11px; color: var(--text-dim); }

  .sc-breakdown { display: flex; flex-direction: column; gap: 8px; }
  .sc-brow { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .sc-bdot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .sc-bname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-bval { font-size: 12px; color: var(--text-dim); white-space: nowrap; }

  .sc-vs { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 8px 10px; align-items: center; margin-top: 10px; }
  .sc-vs-h { font-size: 10px; letter-spacing: 0.14em; color: var(--text-dim); text-align: right; }
  .sc-vs-l { font-size: 12px; color: var(--text-dim); }
  .sc-vs-v { font-size: 13px; font-weight: 600; text-align: right; }

  .sc-hm { display: flex; gap: 3px; margin-top: 10px; }
  .sc-hm-col { display: flex; flex-direction: column; gap: 3px; flex: 1; }
  .sc-hm-cell { aspect-ratio: 1; border-radius: 3px; background: var(--panel-2); }
  .sc-hm-cell[data-l="-1"] { background: transparent; }
  .sc-hm-cell[data-l="1"], .sc-hm-cell[data-l="2"], .sc-hm-cell[data-l="3"], .sc-hm-cell[data-l="4"] { background: var(--cyan); }
  .sc-hm-cell[data-l="1"] { opacity: 0.28; }
  .sc-hm-cell[data-l="2"] { opacity: 0.5; }
  .sc-hm-cell[data-l="3"] { opacity: 0.75; }
  .sc-hm-legend { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 8px; font-size: 10px; color: var(--text-dim); }
  .sc-hm-legend .sc-hm-cell { width: 12px; flex: none; }

  .sc-emblems { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; }
  .sc-emblem { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .sc-emblem-label { font-size: 10px; color: var(--text-dim); }

  .sc-warn { font-size: 12px; color: var(--amber); margin: 6px 0 10px; line-height: 1.45; }
  [data-theme="light"] .sc-warn { color: #B7791F; }
  .sc-facts { margin: 8px 0 0; padding-left: 18px; font-size: 14px; line-height: 1.6; }
  .sc-facts li { margin-bottom: 4px; }
  .sc-facts strong { color: var(--cyan-text); }
  .sc-table-wrap { overflow-x: auto; margin-top: 10px; }
  .sc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .sc-table th { text-align: left; font-family: ui-monospace, "JetBrains Mono", monospace; font-size: 10px; letter-spacing: 0.1em; color: var(--text-dim); font-weight: 600; padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .sc-table td { padding: 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .sc-table tr:last-child td { border-bottom: none; }
  .sc-tr-me td { background: var(--panel-2); }
  .sc-legal-note { font-size: 11px; }
  select.input-field { height: 42px; margin-top: 8px; }
  .sc-settings { display: flex; flex-direction: column; gap: 16px; }
  .sc-setting { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  .sc-setting-txt { min-width: 0; }
  .sc-setting-label { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .sc-setting-hint { font-size: 12px; color: var(--text-dim); line-height: 1.45; margin-top: 3px; }
  .sc-setting .switch { flex: none; }
  .sc-setting-block { display: flex; flex-direction: column; gap: 8px; }
  .sc-name-edit { display: flex; gap: 8px; align-items: center; }
  .sc-blocked { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; font-weight: 600; }
  .sc-ok { color: var(--green); font-size: 13px; }
  [data-theme="light"] .sc-streak, [data-theme="light"] .sc-hero-streak, [data-theme="light"] .sc-offline { color: #B7791F; }
  [data-theme="light"] .sc-rank-name, [data-theme="light"] .sc-hero-rank { filter: brightness(0.82); }
`;
