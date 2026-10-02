import React, { useMemo, useRef, useState } from "react";
import SeasonEnd from "./SeasonEnd.jsx";
import {
  computeStats, getCurrentSeason, computeSeasonRango, getSeasonHistory,
  RANK_NAMES, RANK_QUIPS, RANK_THRESHOLDS,
  STREAK_TIERS, streakTierForDays, hm, APP_SHARE_URL,
} from "./domain.js";

/* ------------------------------------------------------------------ */
/*  Pestaña "Rangos": rango de la season actual (puntos), racha de   */
/*  días seguidos estudiando e historial de seasons pasadas. Todo se    */
/*  calcula en vivo a partir de `entries`/`logs` reales — nada se       */
/*  "cierra" ni se guarda aparte, así que al cambiar de season el rango  */
/*  simplemente empieza de cero (el rango de la season anterior sigue   */
/*  disponible para siempre en el Historial, calculado sobre su propio   */
/*  rango de fechas fijo).                                              */
/* ------------------------------------------------------------------ */

function fmtNum(n, decimals = 1) {
  return (Math.round(n * 10 ** decimals) / 10 ** decimals).toFixed(decimals).replace(".", ",");
}

function fmtThreshold(n) {
  return Number.isInteger(n) ? String(n) : fmtNum(n, 1);
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L7.04 9.81C6.5 9.31 5.79 9 5 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function prefetchRangosImages() {
  const urls = [];
  for (let i = 0; i < 7; i++) urls.push(`/rangos/rank-badges/badge-${i}.webp`, `/rangos/rank-bg/rank-${i}.webp`);
  for (let i = 0; i < 6; i++) urls.push(`/rangos/streak-bg/streak-${i}.webp`);
  urls.forEach((u) => { const im = new Image(); im.decoding = "async"; im.src = u; });
}

function RankEmblem({ tier, size }) {
  return (
    <img
      src={`/rangos/rank-badges/badge-${tier}.webp`}
      width={size}
      alt={`Emblema ${RANK_NAMES[tier]}`}
      style={{ filter: "drop-shadow(0 4px 12px rgba(79,216,234,0.33))" }}
    />
  );
}

/* -------------------------- RANGO -------------------------- */

function RankLadderRow({ tier, cur, previewTier, onPreview }) {
  const status = tier < cur ? "ok" : tier === cur ? "cur" : "lock";
  return (
    <button
      type="button"
      className={`rt-lrow ${previewTier === tier ? "rt-sel" : ""} ${status === "cur" ? "rt-cur" : ""} ${status === "lock" ? "rt-lock" : ""}`}
      onClick={() => onPreview(tier)}
    >
      <div className="rt-emw"><RankEmblem tier={tier} size={38} /></div>
      <div className="rt-nm">
        <p>{RANK_NAMES[tier]}</p>
        <p>{RANK_QUIPS[tier]}</p>
      </div>
      <div className="rt-th">
        {tier === RANK_THRESHOLDS.length - 1 ? `${fmtThreshold(RANK_THRESHOLDS[tier])}+` : `${fmtThreshold(RANK_THRESHOLDS[tier])} – ${fmtThreshold(RANK_THRESHOLDS[tier + 1])}`}
        <br />pts
      </div>
      {status === "ok" && <span className="rt-pill rt-p-ok"><CheckIcon /></span>}
      {status === "cur" && <span className="rt-pill rt-p-cur">ACTUAL</span>}
      {status === "lock" && <span className="rt-pill rt-p-lock"><LockIcon /></span>}
    </button>
  );
}

// Tamaño del emblema en la tarjeta de rango, como fracción del ancho de la foto: crece con el rango
// y ATLAS es el mayor.
const RANK_EMBLEM_SCALE = [0.17, 0.19, 0.21, 0.23, 0.25, 0.27, 0.33];

function RangoShareCard({ shareRef, rango, season }) {
  const { tier, puntos } = rango;
  return (
    <div ref={shareRef} className="rt-hero rt-hero-share">
      <img className="rt-sc" decoding="async" src={`/rangos/rank-bg/rank-${tier}.webp`} alt="" />
      <div className="rt-tint" />
      <p className="rt-season rt-mono">{season.label.toUpperCase()}</p>
      <div className="rt-herocard">
        <div className="rt-emwrap"><RankEmblem tier={tier} size={104} /></div>
        <h2 className="rt-rname">{RANK_NAMES[tier]}</h2>
        <p className="rt-rquip">{RANK_QUIPS[tier]}</p>
        <p className="rt-share-stat rt-mono">{fmtNum(puntos)} puntos</p>
      </div>
      <div className="rt-share-brand">Clever · Bitácora de vuelo</div>
    </div>
  );
}

function RangoView({ subjects, entries, logs }) {
  const { season, live } = useMemo(() => getCurrentSeason(), []);
  const rango = useMemo(() => computeSeasonRango(subjects, entries, logs, season), [subjects, entries, logs, season]);
  const [previewTier, setPreviewTier] = useState(rango.tier);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);
  const shareRef = useRef(null);

  const cur = rango.tier;
  const isMax = cur >= RANK_THRESHOLDS.length - 1;
  const lo = RANK_THRESHOLDS[cur];
  const hi = isMax ? null : RANK_THRESHOLDS[cur + 1];
  const progressPct = isMax ? 100 : Math.max(0, Math.min(100, ((rango.puntos - lo) / (hi - lo)) * 100));
  const puntosFaltantes = isMax ? 0 : Math.max(0, hi - rango.puntos);

  async function handleShare() {
    if (sharing || !shareRef.current) return;
    setSharing(true);
    setShareError(null);
    try {
      const { shareNodeAsImage } = await import("./shareImage.js");
      await shareNodeAsImage(shareRef.current, {
        fileName: "clever-rango.png",
        title: "Mi rango — Clever",
        text: `Este season voy de ${RANK_NAMES[cur]} en Clever ✈️\n${APP_SHARE_URL}`,
      });
    } catch (e) {
      if (!(e && e.name === "AbortError")) setShareError(String((e && e.message) || e));
    } finally {
      setSharing(false);
    }
  }

  const previewData = {
    tier: previewTier,
    isSurpassed: previewTier < cur,
    isLocked: previewTier > cur,
  };

  return (
    <div>
      <SeasonEnd season={season} live={live} size="lg" />
      <div className="rt-hero" style={{ "--es": RANK_EMBLEM_SCALE[previewTier] }}>
        <img className="rt-sc" decoding="async" src={`/rangos/rank-bg/rank-${previewTier}.webp`} alt="" />
        <div className="rt-tint" />
        <p className="rt-season rt-mono">{season.label.toUpperCase()}</p>
        {previewTier !== cur && (
          <span className={`rt-pill rt-mono rt-prevtag ${previewData.isSurpassed ? "rt-p-ok" : "rt-p-lock"}`}>
            {previewData.isSurpassed ? "SUPERADO" : "BLOQUEADA"}
          </span>
        )}
        <div className="rt-herocard">
          <div className="rt-emwrap"><RankEmblem tier={previewTier} size={104} /></div>
          <h2 className="rt-rname">{RANK_NAMES[previewTier]}</h2>
          <p className="rt-rquip">{RANK_QUIPS[previewTier]}</p>
        </div>
      </div>

      <div className="rt-panel-actions">
        <button type="button" className="btn-ghost btn-small share-btn" onClick={handleShare} disabled={sharing} title="Compartir tu rango como imagen">
          <ShareIcon /> {sharing ? "Generando…" : "Compartir"}
        </button>
      </div>
      {shareError && <div className="auth-error" style={{ marginBottom: 10 }}>{shareError}</div>}

      <div className="rt-stats rt-mono">
        <div className="rt-stat"><p>Puntos</p><p>{fmtNum(rango.puntos)}</p></div>
        <div className="rt-stat"><p>Minutos</p><p>{rango.minutosTotales.toLocaleString("es-ES")}</p></div>
        <div className="rt-stat"><p>Mejor sesión</p><p>{rango.mejorSesion > 0 ? hm(rango.mejorSesion) : "—"}</p></div>
        <div className="rt-stat"><p>Asignaturas</p><p>{rango.numAsignaturas}</p></div>
      </div>

      <div className="rt-card">
        <div className="rt-progrow">
          <p className="rt-proglabel">
            {isMax ? "Rango máximo alcanzado" : `Progreso hasta ${RANK_NAMES[cur + 1]}`}
          </p>
          <p className="rt-mono rt-progval">
            {isMax ? "puntos máximo" : `${fmtNum(rango.puntos)} / ${fmtThreshold(hi)} pts`}
          </p>
        </div>
        <div className="rt-track"><i style={{ width: `${progressPct}%` }} /></div>
        <p className="rt-proghelp">
          {isMax
            ? "No hay rango más alto — sigue estudiando para mantenerlo."
            : `Te faltan ${fmtNum(puntosFaltantes)} puntos para el siguiente rango.`}
        </p>
      </div>


      <div className="rt-card">
        <p className="rt-proglabel">¿Cómo se calculan los puntos?</p>
        <p className="rt-proghelp">
          Cada hora que estudias dentro de la season es <strong>1 punto</strong>, de la asignatura que sea. Todos
          suman lo mismo por hora estudiada.
        </p>
        <p className="rt-proghelp">
          Ejemplo: 3 h en una asignatura y 2 h en otra son 5 puntos. Solo cuentan las horas registradas dentro de la season; las asignaturas sin créditos no puntúan.
        </p>
      </div>

      <p className="rt-eyebrow" style={{ margin: "14px 0 8px" }}>Clasificación de rangos</p>
      <div>
        {[...RANK_NAMES.keys()].sort((a, b) => b - a).map((tier) => (
          <RankLadderRow key={tier} tier={tier} cur={cur} previewTier={previewTier} onPreview={setPreviewTier} />
        ))}
      </div>

      <div className="rt-share-offscreen" aria-hidden="true">
        <RangoShareCard shareRef={shareRef} rango={rango} season={season} />
      </div>
    </div>
  );
}

/* -------------------------- RACHA -------------------------- */

function RachaShareCard({ shareRef, days, tier }) {
  const t = STREAK_TIERS[tier];
  return (
    <div ref={shareRef} className="rt-scene rt-scene-share">
      <img className="rt-bg" decoding="async" src={`/rangos/streak-bg/${t.img}.webp`} alt="" />
      <div className="rt-top" /><div className="rt-fade" />
      <span className="rt-pill rt-mono rt-tiertag">{t.name.toUpperCase()}</span>
      <div className="rt-fg">
        <p className="rt-bignum">{days}</p>
        <p className="rt-cap">días seguidos</p>
      </div>
      <p className="rt-qline">{t.quip}</p>
      <div className="rt-share-brand">Clever · Bitácora de vuelo</div>
    </div>
  );
}

function RachaView({ subjects, entries, logs }) {
  const stats = useMemo(() => computeStats(subjects, entries, logs), [subjects, entries, logs]);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);
  const shareRef = useRef(null);

  const days = stats.current;
  const tier = streakTierForDays(days);
  const t = STREAK_TIERS[tier];
  const next = STREAK_TIERS[tier + 1];

  async function handleShare() {
    if (sharing || !shareRef.current) return;
    setSharing(true);
    setShareError(null);
    try {
      const { shareNodeAsImage } = await import("./shareImage.js");
      await shareNodeAsImage(shareRef.current, {
        fileName: "clever-racha.png",
        title: "Mi racha — Clever",
        text: `Llevo ${days} días seguidos estudiando en Clever 🔥\n${APP_SHARE_URL}`,
      });
    } catch (e) {
      if (!(e && e.name === "AbortError")) setShareError(String((e && e.message) || e));
    } finally {
      setSharing(false);
    }
  }

  return (
    <div>
      <div className="rt-scene">
        <span className="rt-pill rt-mono rt-tiertag">{t.name.toUpperCase()}</span>
        <img className="rt-bg" decoding="async" src={`/rangos/streak-bg/${t.img}.webp`} alt="" />
        <div className="rt-top" /><div className="rt-fade" />
        <div className="rt-fg">
          <p className="rt-bignum" style={{ fontSize: `${Math.min(96, 62 + Math.min(days, 20) * 1.7)}px` }}>{days}</p>
          <p className="rt-cap">días seguidos</p>
        </div>
        <p className="rt-qline">{t.quip}</p>
      </div>

      <div className="rt-panel-actions">
        <button type="button" className="btn-ghost btn-small share-btn" onClick={handleShare} disabled={sharing} title="Compartir tu racha como imagen">
          <ShareIcon /> {sharing ? "Generando…" : "Compartir"}
        </button>
      </div>
      {shareError && <div className="auth-error" style={{ marginBottom: 10 }}>{shareError}</div>}

      <div className="rt-stats rt-mono">
        <div className="rt-stat"><p>Récord</p><p>{stats.longest} días</p></div>
        <div className="rt-stat">
          <p>Próximo hito</p>
          <p style={{ fontSize: 13 }}>{next ? `${next.days - days} días` : "Nivel máximo"}</p>
        </div>
      </div>

      <div className="rt-card">
        <p className="rt-eyebrow" style={{ marginBottom: 8 }}>
          {next ? `Faltan ${next.days - days} días para: ${next.name}` : "Nivel máximo alcanzado"}
        </p>
        <p className="gauge-sub" style={{ margin: 0 }}>
          {days > 0
            ? "Estudia hoy para no perder la racha."
            : "Registra hoy tu primera sesión para empezar una racha nueva."}
        </p>
      </div>

      <div className="rt-share-offscreen" aria-hidden="true">
        <RachaShareCard shareRef={shareRef} days={days} tier={tier} />
      </div>
    </div>
  );
}

/* -------------------------- HISTORIAL -------------------------- */

function HistorialTile({ entry }) {
  const [sharing, setSharing] = useState(false);
  const ref = useRef(null);

  async function handleShare(e) {
    e.stopPropagation();
    if (sharing || !ref.current) return;
    setSharing(true);
    try {
      const { shareNodeAsImage } = await import("./shareImage.js");
      await shareNodeAsImage(ref.current, {
        fileName: "clever-season.png",
        title: `${entry.season.label} — Clever`,
        text: `Terminé la ${entry.season.label} como ${RANK_NAMES[entry.tier]} en Clever ✈️\n${APP_SHARE_URL}`,
      });
    } catch {
      // Cancelar la hoja de compartir nativa no es un error.
    } finally {
      setSharing(false);
    }
  }

  return (
    <div ref={ref} className={`rt-hc ${entry.live ? "rt-hc-live" : ""}`}>
      {!entry.live && (
        <button type="button" className="rt-shr" aria-label="Compartir" onClick={handleShare} disabled={sharing}>
          <ShareIcon />
        </button>
      )}
      <RankEmblem tier={entry.tier} size={76} />
      <p className="rt-sn">{entry.season.label.toUpperCase()}</p>
      <p className="rt-rn">{RANK_NAMES[entry.tier]}</p>
      <p className="rt-hv">{fmtNum(entry.puntos)} pts</p>
      {entry.live && <div style={{ marginTop: 8 }}><span className="rt-pill rt-mono rt-p-live">EN CURSO</span></div>}
    </div>
  );
}

function HistorialView({ subjects, entries, logs }) {
  const history = useMemo(() => getSeasonHistory(subjects, entries, logs), [subjects, entries, logs]);

  if (history.length === 0) {
    return <div className="rt-card" style={{ textAlign: "center", padding: "40px 16px", color: "var(--rt-text-dim)" }}>
      Todavía no hay ninguna season con actividad registrada.
    </div>;
  }

  const completed = history.filter((h) => !h.live);
  const best = (completed.length ? completed : history).reduce((a, b) => (b.tier > a.tier || (b.tier === a.tier && b.puntos > a.puntos) ? b : a));

  return (
    <div>
      <div className="rt-card rt-bestrow">
        <RankEmblem tier={best.tier} size={64} />
        <div>
          <p className="rt-eyebrow" style={{ marginBottom: 4 }}>Mejor rango</p>
          <p style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Manrope',sans-serif" }}>{RANK_NAMES[best.tier]}</p>
          <p className="rt-mono" style={{ fontSize: 11.5, color: "var(--rt-accent)", marginTop: 4 }}>
            {completed.length} season{completed.length === 1 ? "" : "s"} completada{completed.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="rt-hgrid">
        {history.map((entry) => <HistorialTile key={entry.season.id} entry={entry} />)}
      </div>
    </div>
  );
}

/* -------------------------- TAB -------------------------- */

export default function RangosTab({ subjects, entries, logs }) {
  const [sub, setSub] = useState(0);
  return (
    <div className="rt-wrap">
      <div className="rt-seg">
        <button type="button" className={sub === 0 ? "rt-on" : ""} onClick={() => setSub(0)}>Rango</button>
        <button type="button" className={sub === 1 ? "rt-on" : ""} onClick={() => setSub(1)}>Racha</button>
        <button type="button" className={sub === 2 ? "rt-on" : ""} onClick={() => setSub(2)}>Historial</button>
      </div>
      {sub === 0 && <RangoView subjects={subjects} entries={entries} logs={logs} />}
      {sub === 1 && <RachaView subjects={subjects} entries={entries} logs={logs} />}
      {sub === 2 && <HistorialView subjects={subjects} entries={entries} logs={logs} />}
    </div>
  );
}
