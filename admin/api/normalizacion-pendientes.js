import { requireAdmin } from "./_lib/requireAdmin.js";
import { getAdminClient } from "./_lib/adminClient.js";

// Cola de aprobación: universidades/carreras/asignaturas dadas de alta en
// texto libre por los usuarios (o sin coincidencia clara durante la
// migración) que todavía no se han revisado. Las marcadas Erasmus nunca
// llegan aquí (se guardan sin canónica y sin entrar en esta cola).
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireAdmin(req);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const { tipo, parentId, minAgeDays } = req.query;
  const tipos = tipo && !Array.isArray(tipo) ? [tipo] : ["universidad", "carrera", "asignatura"];
  const cutoff = minAgeDays ? new Date(Date.now() - Number(minAgeDays) * 86400000).toISOString() : null;

  const supabase = getAdminClient();

  try {
    const [profilesRes, asignaturasRes] = await Promise.all([
      supabase.from("profiles").select("universidad_canonica_id, carrera_canonica_id"),
      supabase.from("asignaturas").select("asignatura_canonica_id"),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (asignaturasRes.error) throw asignaturasRes.error;

    const universidadUsos = countBy(profilesRes.data, "universidad_canonica_id");
    const carreraUsos = countBy(profilesRes.data, "carrera_canonica_id");
    const asignaturaUsos = countBy(asignaturasRes.data, "asignatura_canonica_id");

    const resultado = {};

    if (tipos.includes("universidad")) {
      let q = supabase.from("universidades_canonicas").select("id, nombre, pais, origen, created_at").eq("estado", "pendiente");
      if (cutoff) q = q.lte("created_at", cutoff);
      const { data, error } = await q.order("created_at", { ascending: true });
      if (error) throw error;
      resultado.universidades = data.map((u) => ({ ...u, usos: universidadUsos.get(u.id) || 0 }));
    }

    if (tipos.includes("carrera")) {
      let q = supabase
        .from("carreras_canonicas")
        .select("id, nombre, origen, created_at, universidad_id, universidades_canonicas(nombre)")
        .eq("estado", "pendiente");
      if (parentId) q = q.eq("universidad_id", parentId);
      if (cutoff) q = q.lte("created_at", cutoff);
      const { data, error } = await q.order("created_at", { ascending: true });
      if (error) throw error;
      resultado.carreras = data.map((c) => ({
        ...c, universidadNombre: c.universidades_canonicas?.nombre ?? null, usos: carreraUsos.get(c.id) || 0,
      }));
    }

    if (tipos.includes("asignatura")) {
      let q = supabase
        .from("asignaturas_canonicas")
        .select("id, nombre_oficial, creditos, origen, created_at, carrera_id, carreras_canonicas(nombre)")
        .eq("estado", "pendiente");
      if (parentId) q = q.eq("carrera_id", parentId);
      if (cutoff) q = q.lte("created_at", cutoff);
      const { data, error } = await q.order("created_at", { ascending: true });
      if (error) throw error;
      resultado.asignaturas = data.map((a) => ({
        ...a, carreraNombre: a.carreras_canonicas?.nombre ?? null, usos: asignaturaUsos.get(a.id) || 0,
      }));
    }

    res.status(200).json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}

function countBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    map.set(value, (map.get(value) || 0) + 1);
  }
  return map;
}
