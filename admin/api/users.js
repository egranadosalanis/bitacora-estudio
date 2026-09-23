import { requireAdmin } from "./_lib/requireAdmin.js";
import { getAdminClient } from "./_lib/adminClient.js";
import { fetchAllRows } from "./_lib/fetchAll.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireAdmin(req);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const supabase = getAdminClient();

  try {
    const [profilesRes, cursosRes, asignaturasRes, registros] = await Promise.all([
      supabase.from("profiles").select("id, email, plan, universidad, carrera, created_at"),
      supabase.from("cursos").select("id, user_id"),
      supabase.from("asignaturas").select("id, user_id"),
      fetchAllRows(() => supabase.from("entradas_estudio").select("user_id, fecha, minutos").order("id")),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (cursosRes.error) throw cursosRes.error;
    if (asignaturasRes.error) throw asignaturasRes.error;

    const cursosByUser = countBy(cursosRes.data, "user_id");
    const asignaturasByUser = countBy(asignaturasRes.data, "user_id");

    const minutesByUser = new Map();
    const lastActivityByUser = new Map();
    for (const r of registros) {
      minutesByUser.set(r.user_id, (minutesByUser.get(r.user_id) || 0) + r.minutos);
      const prev = lastActivityByUser.get(r.user_id);
      if (!prev || r.fecha > prev) lastActivityByUser.set(r.user_id, r.fecha);
    }

    const users = profilesRes.data.map((p) => ({
      id: p.id,
      email: p.email,
      plan: p.plan,
      universidad: p.universidad,
      carrera: p.carrera,
      createdAt: p.created_at,
      cursos: cursosByUser.get(p.id) || 0,
      asignaturas: asignaturasByUser.get(p.id) || 0,
      minutosTotal: minutesByUser.get(p.id) || 0,
      ultimaActividad: lastActivityByUser.get(p.id) || null,
    }));

    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}

function countBy(rows, key) {
  const map = new Map();
  for (const row of rows) map.set(row[key], (map.get(row[key]) || 0) + 1);
  return map;
}
