import { requireAdmin } from "./_lib/requireAdmin.js";
import { getAdminClient } from "./_lib/adminClient.js";

// Busca filas canónicas ya aprobadas para la acción "fusionar con" del panel
// admin. Pasa por el servidor (service_role) igual que el resto de este
// directorio: el cliente del panel nunca consulta las tablas directamente.
const RPC_BY_TIPO = {
  universidad: { fn: "buscar_universidades", parentParam: null },
  carrera: { fn: "buscar_carreras", parentParam: "p_universidad_id" },
  asignatura: { fn: "buscar_asignaturas_canonicas", parentParam: "p_carrera_id" },
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireAdmin(req);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const { tipo, query, parentId } = req.query;
  const rpc = RPC_BY_TIPO[tipo];
  if (!rpc) return res.status(400).json({ error: "tipo debe ser universidad, carrera o asignatura." });
  if (rpc.parentParam && !parentId) return res.status(400).json({ error: "Falta parentId." });

  const supabase = getAdminClient();
  const params = { p_query: query || "", p_limite: 20 };
  if (rpc.parentParam) params[rpc.parentParam] = parentId;

  try {
    const { data, error } = await supabase.rpc(rpc.fn, params);
    if (error) throw error;
    res.status(200).json({ resultados: data.filter((r) => r.estado === "aprobada") });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
