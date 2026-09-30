import { supabase } from "./supabaseClient";
import { OFFLINE_MESSAGE, isNetworkError } from "./offline.js";

/* Capa fina sobre las funciones RPC de Social. Solo se usan estas funciones
   (y la lectura de la fila propia de perfil_social); nunca se leen las demás
   tablas sociales directamente. */

export const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;

const MESSAGES = {
  offline: OFFLINE_MESSAGE,
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
export const setMostrarNotas = (mostrar) => rpc("establecer_mostrar_notas", { p_mostrar: mostrar });
export const buscarUsuarios = (q) => rpc("buscar_usuarios", { p_query: q });
export const solicitarAmistad = (username) => rpc("solicitar_amistad", { p_username: username });
export const responderSolicitud = (id, acepta) => rpc("responder_solicitud", { p_id: id, p_acepta: acepta });
export const quitarAmistad = (username) => rpc("quitar_amistad", { p_username: username });
export const bloquearUsuario = (username) => rpc("bloquear_usuario", { p_username: username });
export const desbloquearUsuario = (username) => rpc("desbloquear_usuario", { p_username: username });
export const misAmistades = () => rpc("mis_amistades");
export const resumenAmigo = (username) => rpc("resumen_amigo", { p_username: username });
export const comunidadStats = (canonicaId) => rpc("comunidad_stats", { p_canonica: canonicaId });
export const listadoAprobados = (canonicaId) => rpc("listado_aprobados", { p_canonica: canonicaId });

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
