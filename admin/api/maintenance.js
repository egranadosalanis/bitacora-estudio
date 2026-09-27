import { requireAdmin } from "./_lib/requireAdmin.js";
import { getAdminClient } from "./_lib/adminClient.js";

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const supabase = getAdminClient();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single();
      if (error) throw error;
      return res.status(200).json(data.value);
    } catch (err) {
      return res.status(500).json({ error: err.message || String(err) });
    }
  }

  if (req.method === "POST") {
    const enabled = Boolean(req.body?.enabled);
    const message = typeof req.body?.message === "string" ? req.body.message.slice(0, 500) : "";
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .upsert({ key: "maintenance_mode", value: { enabled, message }, updated_at: new Date().toISOString() })
        .select("value")
        .single();
      if (error) throw error;
      return res.status(200).json(data.value);
    } catch (err) {
      return res.status(500).json({ error: err.message || String(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
