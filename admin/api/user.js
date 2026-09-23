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

  const id = req.query.id;
  if (!id || Array.isArray(id)) return res.status(400).json({ error: "Falta el parámetro id." });

  const supabase = getAdminClient();

  try {
    const [profileRes, cursosRes, asignaturasRes, entradas] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).single(),
      supabase.from("cursos").select("*").eq("user_id", id).order("start_date", { ascending: false }),
      supabase.from("asignaturas").select("*").eq("user_id", id),
      fetchAllRows(() =>
        supabase
          .from("entradas_estudio")
          .select("fecha, minutos, asignatura_id")
          .eq("user_id", id)
          .order("fecha", { ascending: true })
          .order("id", { ascending: true })
      ),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (cursosRes.error) throw cursosRes.error;
    if (asignaturasRes.error) throw asignaturasRes.error;

    // La app guarda una entrada por cada "Guardar"; aquí se suman por día y
    // asignatura para que el panel siga viendo un registro por día, como antes.
    const porDiaYAsignatura = new Map();
    for (const e of entradas) {
      const key = `${e.fecha}|${e.asignatura_id}`;
      const prev = porDiaYAsignatura.get(key);
      if (prev) prev.minutos += e.minutos;
      else porDiaYAsignatura.set(key, { fecha: e.fecha, minutos: e.minutos, asignatura_id: e.asignatura_id });
    }
    const registros = Array.from(porDiaYAsignatura.values());

    const minutosPorAsignatura = new Map();
    for (const r of registros) {
      minutosPorAsignatura.set(r.asignatura_id, (minutosPorAsignatura.get(r.asignatura_id) || 0) + r.minutos);
    }
    const asignaturas = asignaturasRes.data
      .map((a) => ({ ...a, minutosTotal: minutosPorAsignatura.get(a.id) || 0 }))
      .sort((a, b) => b.minutosTotal - a.minutosTotal);

    res.status(200).json({
      profile: profileRes.data,
      cursos: cursosRes.data,
      asignaturas,
      registros,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
