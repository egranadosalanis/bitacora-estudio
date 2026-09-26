import { supabase } from "./supabaseClient.js";

async function authedFetch(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
  return body;
}

export const fetchOverview = () => authedFetch("overview");
export const fetchUsers = () => authedFetch("users");
export const fetchUser = (id) => authedFetch(`user?id=${encodeURIComponent(id)}`);

export const fetchNormalizacionPendientes = (filters = {}) =>
  authedFetch(`normalizacion-pendientes?${new URLSearchParams(filters)}`);

export const buscarNormalizacion = (tipo, query, parentId) =>
  authedFetch(`normalizacion-buscar?${new URLSearchParams({ tipo, query: query || "", ...(parentId ? { parentId } : {}) })}`);

export const postNormalizacionAccion = (payload) =>
  authedFetch("normalizacion-accion", { method: "POST", body: JSON.stringify(payload) });
