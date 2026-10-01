import React from "react";
import { addDays } from "./domain.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «1 de febrero de 2027». */
function fechaLarga(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** Aviso destacado de cuándo termina la season. La season acaba el último día de su rango, así
 * que la fecha que se muestra es el día siguiente (el 1 de febrero para la que termina el 31 de
 * enero), igual que en el aviso que ya había en Rangos. */
export default function SeasonEnd({ season, live, size = "md" }) {
  const fecha = fechaLarga(addDays(season.endDate, 1));
  return (
    <p className={`season-end season-end-${size}`}>
      <span className="season-end-pre">{live ? "La season actual termina el" : "La season terminó el"}</span>{" "}
      <strong className="season-end-date">{fecha}</strong>
    </p>
  );
}

export const SEASON_END_CSS = `
  .season-end { margin: 0; font-family: "Manrope", sans-serif; line-height: 1.25; color: #7FE6FA; text-shadow: 0 0 18px rgba(79, 216, 234, 0.55), 0 0 2px rgba(79, 216, 234, 0.6); }
  [data-theme="light"] .season-end { color: #0B5E86; text-shadow: 0 1px 10px rgba(11, 94, 134, 0.18); }
  .season-end-pre { font-weight: 600; letter-spacing: 0.01em; opacity: 0.9; }
  .season-end-date { font-weight: 800; letter-spacing: 0.005em; }
  .season-end-sm { font-size: 14px; text-align: right; }
  .season-end-lg { font-size: clamp(19px, 4.8vw, 26px); text-align: center; margin: 4px 0 14px; }
`;
