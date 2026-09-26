import { requireAdmin } from "./_lib/requireAdmin.js";
import { getAdminClient } from "./_lib/adminClient.js";

// Las 4 acciones de la cola de aprobación. Body: { accion, tipo, id,
// nombreNuevo? (renombrar_aprobar), destinoId? (fusionar) }.
const TABLA = { universidad: "universidades_canonicas", carrera: "carreras_canonicas", asignatura: "asignaturas_canonicas" };
const COLUMNA_NOMBRE = { universidad: "nombre", carrera: "nombre", asignatura: "nombre_oficial" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireAdmin(req);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const { accion, tipo, id, nombreNuevo, destinoId } = req.body || {};
  const tabla = TABLA[tipo];
  if (!tabla) return res.status(400).json({ error: "tipo debe ser universidad, carrera o asignatura." });
  if (!id) return res.status(400).json({ error: "Falta id." });

  const supabase = getAdminClient();

  try {
    switch (accion) {
      case "aprobar": {
        const { error } = await supabase.from(tabla).update({ estado: "aprobada" }).eq("id", id);
        if (error) throw error;
        break;
      }
      case "renombrar_aprobar": {
        if (!nombreNuevo || !nombreNuevo.trim()) return res.status(400).json({ error: "Falta nombreNuevo." });
        const { error } = await supabase
          .from(tabla)
          .update({ [COLUMNA_NOMBRE[tipo]]: nombreNuevo.trim(), estado: "aprobada" })
          .eq("id", id);
        if (error) throw error;
        break;
      }
      case "rechazar": {
        const { error } = await supabase.from(tabla).update({ estado: "rechazada" }).eq("id", id);
        if (error) throw error;
        break;
      }
      case "fusionar": {
        if (!destinoId) return res.status(400).json({ error: "Falta destinoId." });
        const { error } = await supabase.rpc("fusionar_normalizacion", { p_tipo: tipo, p_origen: id, p_destino: destinoId });
        if (error) throw error;
        break;
      }
      default:
        return res.status(400).json({ error: "accion debe ser aprobar, renombrar_aprobar, fusionar o rechazar." });
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
