import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sin tiempo de espera, con una conexión caída "a medias" (wifi sin salida,
// cobertura muy mala) la petición puede quedarse colgada indefinidamente y
// la app en una pantalla de carga eterna. A los 20 s se aborta y el error
// se trata como "sin conexión".
const REQUEST_TIMEOUT_MS = 20000;

function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { experimental: { passkey: true } },
  global: { fetch: fetchWithTimeout },
});
