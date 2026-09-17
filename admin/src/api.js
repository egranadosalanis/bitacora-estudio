import { supabase } from "./supabaseClient.js";

async function authedFetch(path) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
  return body;
}

export const fetchOverview = () => authedFetch("overview");
export const fetchUsers = () => authedFetch("users");
export const fetchUser = (id) => authedFetch(`user?id=${encodeURIComponent(id)}`);
