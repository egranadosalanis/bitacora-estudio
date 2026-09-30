import { supabase } from "./supabaseClient";
import { OFFLINE_MESSAGE, isNetworkError } from "./offline.js";

/* Capa fina sobre las funciones RPC de Social. Solo se usan estas funciones
   (y la lectura de la fila propia de perfil_social); nunca se leen las demás
   tablas sociales directamente. */

export const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;
// Solo se admiten fotos de Google (la base de datos lo comprueba también).
export const GOOGLE_AVATAR_RE = /^https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_/=.-]+$/;

const MESSAGES = {
  offline: OFFLINE_MESSAGE,
  avatar_invalido: "Esa foto no se puede usar.",
  username_en_uso: "Ese nombre de usuario ya está cogido. Prueba con otro.",
  username_invalido: "Usa entre 3 y 20 caracteres: letras, números, punto o guion bajo.",
  username_reservado: "Ese nombre de usuario no está disponible.",
  perfil_ya_existe: "Ya tienes un nombre de usuario.",
  sin_perfil_social: "Primero tienes que elegir tu nombre de usuario.",
  // Mensaje neutro a propósito: no revela si el usuario existe, si ya hay una
  // solicitud o si te ha bloqueado.
  solicitud_existente: "No se ha podido enviar la solicitud. Puede que ya exista una o que ese usuario no esté disponible.",
  usuario_no_encontrado: "No se ha podido enviar la solicitud. Puede que ya exista una o que ese usuario no esté disponible.",
  no_disponible: "No se ha podido enviar la solicitud. Puede que ya exista una o que ese usuario no esté disponible.",
  solicitud_no_encontrada: "Esa solicitud ya no existe.",
  amistad_no_encontrada: "Esa amistad ya no existe.",
  consentimiento_propio_requerido: "Necesitas aceptar compartir tus métricas para usar esta función.",
};
const CODES = Object.keys(MESSAGES);

export class SocialError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SocialError";
    this.code = code;
  }
}

function toSocialError(error) {
  if (isNetworkError(error)) return new SocialError("offline", OFFLINE_MESSAGE);
  const raw = String(error?.message ?? error ?? "");
  const code = CODES.find((c) => raw.includes(c));
  if (code) return new SocialError(code, MESSAGES[code]);
  return new SocialError("desconocido", "Algo ha fallado. Inténtalo de nuevo.");
}

async function rpc(name, args) {
  let res;
  try {
    res = await supabase.rpc(name, args);
  } catch (e) {
    throw toSocialError(e);
  }
  if (res.error) throw toSocialError(res.error);
  return res.data;
}

/** Fila propia de perfil_social (la política de RLS solo deja leer la propia). */
export async function getMiPerfilSocial(userId) {
  let res;
  try {
    res = await supabase.from("perfil_social").select("*").eq("user_id", userId).maybeSingle();
  } catch (e) {
    throw toSocialError(e);
  }
  if (res.error) throw toSocialError(res.error);
  return res.data ?? null;
}

export const crearPerfilSocial = (username) => rpc("crear_perfil_social", { p_username: username });
export const cambiarUsername = (username) => rpc("cambiar_username", { p_username: username });
export const setConsentimiento = (tipo, acepta, version) =>
  rpc("establecer_consentimiento", { p_tipo: tipo, p_acepta: acepta, p_version: version ?? null });
export const establecerAvatar = (url) => rpc("establecer_avatar", { p_url: url });
export const setMostrarFoto = (mostrar) => rpc("establecer_mostrar_foto", { p_mostrar: mostrar });
export const establecerFoto = (path) => rpc("establecer_foto", { p_path: path });
export const setMostrarNotas = (mostrar) => rpc("establecer_mostrar_notas", { p_mostrar: mostrar });
export const buscarUsuarios = (q) => rpc("buscar_usuarios", { p_query: q });
export const solicitarAmistad = (username) => rpc("solicitar_amistad", { p_username: username });
export const responderSolicitud = (id, acepta) => rpc("responder_solicitud", { p_id: id, p_acepta: acepta });
export const quitarAmistad = (username) => rpc("quitar_amistad", { p_username: username });
export const bloquearUsuario = (username) => rpc("bloquear_usuario", { p_username: username });
export const desbloquearUsuario = (username) => rpc("desbloquear_usuario", { p_username: username });
export const misAmistades = () => rpc("mis_amistades");
export const miResumen = () => rpc("mi_resumen");
export const resumenAmigo = (username) => rpc("resumen_amigo", { p_username: username });
export const comunidadStats = (canonicaId) => rpc("comunidad_stats", { p_canonica: canonicaId });
export const listadoAprobados = (canonicaId) => rpc("listado_aprobados", { p_canonica: canonicaId });
export const detalleAprobado = (canonicaId, username) => rpc("detalle_aprobado", { p_canonica: canonicaId, p_username: username });

/* ---------- invitaciones por enlace ---------- */

const INVITE_KEY = "clever:invitar";
const INVITE_TTL_MS = 14 * 24 * 3600 * 1000;

/** Guarda (si es válido) el nombre de usuario del enlace ?invitar=... y limpia
 * la URL. Se guarda en el navegador porque, al registrarse, la confirmación
 * por email pierde los parámetros de la dirección. */
export function captureInviteFromUrl() {
  try {
    const url = new URL(window.location.href);
    const u = url.searchParams.get("invitar");
    if (u === null) return;
    if (USERNAME_RE.test(u)) window.localStorage.setItem(INVITE_KEY, JSON.stringify({ u, t: Date.now() }));
    url.searchParams.delete("invitar");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
  } catch {
    // Sin almacenamiento (modo privado): la invitación simplemente no se recuerda.
  }
}

export function readPendingInvite() {
  try {
    const raw = window.localStorage.getItem(INVITE_KEY);
    if (!raw) return null;
    const { u, t } = JSON.parse(raw);
    if (!USERNAME_RE.test(u) || Date.now() - t > INVITE_TTL_MS) {
      window.localStorage.removeItem(INVITE_KEY);
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try { window.localStorage.removeItem(INVITE_KEY); } catch { /* nada */ }
}

/* ---------- fotos de perfil ---------- */

export function photoUrl(path) {
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

/** Dirección de la foto de una persona: la que subió ella y, si no, la de Google.
 * Sirve para filas de la base de datos (avatar_path / avatar_url) y para modelos
 * ya convertidos (avatarPath / avatarUrl). */
export function avatarSrc(row) {
  if (!row) return null;
  const path = row.avatar_path ?? row.avatarPath ?? null;
  if (path) return photoUrl(path);
  return row.avatar_url ?? row.avatarUrl ?? null;
}

// Recorta la imagen a un cuadrado de 160 px y la guarda como JPEG ligero: así se
// sube poco, se quitan los datos EXIF (ubicación, etc.) y cabe en el límite de 100 KB.
async function resizeToJpeg(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new SocialError("foto", "No se ha podido leer esa imagen. Prueba con otra (JPG, PNG o WebP).");
  }
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const side = Math.min(bitmap.width, bitmap.height);
  canvas.getContext("2d").drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  if (bitmap.close) bitmap.close();
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
    if (blob && blob.size <= 90 * 1024) return blob;
  }
  throw new SocialError("foto", "No se ha podido reducir esa imagen.");
}

async function removeOld(path) {
  if (!path) return;
  try { await supabase.storage.from("avatars").remove([path]); } catch { /* si falla, queda un archivo suelto sin importancia */ }
}

/** Sube la foto elegida, la asocia al perfil y borra la anterior. Devuelve la ruta nueva. */
export async function uploadAvatar(userId, file, previousPath) {
  if (!file || !String(file.type).startsWith("image/")) throw new SocialError("foto", "Elige una imagen (JPG, PNG o WebP).");
  if (file.size > 8 * 1024 * 1024) throw new SocialError("foto", "Esa imagen pesa demasiado (máximo 8 MB).");
  const blob = await resizeToJpeg(file);
  const path = `${userId}/${Date.now()}.jpg`;
  let res;
  try {
    res = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  } catch (e) {
    throw toSocialError(e);
  }
  if (res.error) throw toSocialError(res.error);
  await establecerFoto(path);
  await removeOld(previousPath);
  return path;
}

export async function removeAvatar(previousPath) {
  await establecerFoto(null);
  await removeOld(previousPath);
}
