export const OFFLINE_MESSAGE = "Sin conexión. Comprueba tu internet e inténtalo de nuevo";

// Los fallos de red llegan de formas distintas según quién los lance: fetch
// ("Failed to fetch" en Chrome, "Load failed" en Safari, "NetworkError…" en
// Firefox), postgrest-js (lo envuelve en error.message), auth-js
// (AuthRetryableFetchError) o nuestro propio tiempo de espera (AbortError).
const NETWORK_RE = /failed to fetch|load failed|networkerror|network request failed|fetch failed|network error|err_internet|aborted/i;

export function isNetworkError(e) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!e) return false;
  if (e.name === "AbortError" || e.name === "AuthRetryableFetchError") return true;
  return NETWORK_RE.test(String(e.message ?? e));
}

/** Texto para mostrar al usuario: el mensaje de "sin conexión" si es un fallo
 * de red, y si no, el mensaje original del error. */
export function friendlyError(e) {
  return isNetworkError(e) ? OFFLINE_MESSAGE : String((e && e.message) || e);
}
