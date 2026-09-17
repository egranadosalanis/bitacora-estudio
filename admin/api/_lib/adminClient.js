import { createClient } from "@supabase/supabase-js";

let client;

// Cliente con la service_role key: salta el Row Level Security, así que solo
// se usa aquí (en el servidor) y nunca se manda al navegador.
export function getAdminClient() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
    }
    client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
