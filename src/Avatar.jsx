import React, { useState, useEffect } from "react";

// Colores para las iniciales (los mismos tonos de la paleta de la app).
const COLORS = ["#4FD8EA", "#F5A623", "#3DDC84", "#A78BFA", "#FB923C", "#2DD4BF", "#FF8FB3", "#8DA3F0"];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/** Foto de perfil (la de Google, si la hay) o, si no, la inicial del nombre en un
 * círculo de color. Si la foto no carga, también cae a la inicial. */
export default function Avatar({ name, url, size = 32 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  const label = String(name || "?");
  if (url && !failed) {
    return (
      <img
        className="avatar" src={url} alt="" width={size} height={size} referrerPolicy="no-referrer"
        onError={() => setFailed(true)} style={{ width: size, height: size }}
      />
    );
  }
  const color = COLORS[hash(label.toLowerCase()) % COLORS.length];
  return (
    <span
      className="avatar avatar-initial" aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44), background: `${color}38`, border: `1px solid ${color}80` }}
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

/** Contenido del botón de cuenta de la cabecera: foto si la hay; si no, la inicial. */
export function AccountAvatar({ url, letter }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  if (url && !failed) {
    return <img className="profile-photo" src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  }
  return <>{letter}</>;
}

export const AVATAR_CSS = `
  .avatar { border-radius: 50%; flex: none; object-fit: cover; display: inline-flex; align-items: center; justify-content: center; }
  .avatar-initial { font-weight: 700; color: var(--text); line-height: 1; }
  .profile-btn { overflow: hidden; }
  .profile-photo { width: 100%; height: 100%; object-fit: cover; display: block; }
  @media (min-width: 641px) {
    .profile-btn { width: 40px; height: 40px; border-radius: 20px; font-size: 16px; }
  }
`;
