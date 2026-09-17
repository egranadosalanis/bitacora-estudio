import { requireAdmin } from "./_lib/requireAdmin.js";
import { getAdminClient } from "./_lib/adminClient.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireAdmin(req);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const supabase = getAdminClient();

  try {
    const [profilesRes, cursosRes, asignaturasRes, registrosRes] = await Promise.all([
      supabase.from("profiles").select("id, plan, universidad, carrera, created_at"),
      supabase.from("cursos").select("id", { count: "exact", head: true }),
      supabase.from("asignaturas").select("id", { count: "exact", head: true }),
      supabase.from("registros_estudio").select("user_id, fecha, minutos"),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (cursosRes.error) throw cursosRes.error;
    if (asignaturasRes.error) throw asignaturasRes.error;
    if (registrosRes.error) throw registrosRes.error;

    const profiles = profilesRes.data;
    const registros = registrosRes.data;

    const planCounts = {};
    for (const p of profiles) planCounts[p.plan] = (planCounts[p.plan] || 0) + 1;

    const signupsByWeek = bucketByWeek(profiles, 12, (p) => p.created_at).map(({ week, value }) => ({
      week,
      count: value,
    }));
    const minutesByWeek = bucketByWeek(registros, 12, (r) => r.fecha, (r) => r.minutos).map(({ week, value }) => ({
      week,
      minutes: value,
    }));

    const now = Date.now();
    const activeUsers = (days) => {
      const cutoff = now - days * 86400000;
      const set = new Set();
      for (const r of registros) {
        if (new Date(r.fecha).getTime() >= cutoff) set.add(r.user_id);
      }
      return set.size;
    };

    const totalMinutes = registros.reduce((sum, r) => sum + r.minutos, 0);

    res.status(200).json({
      totalUsers: profiles.length,
      planCounts,
      totalCursos: cursosRes.count ?? 0,
      totalAsignaturas: asignaturasRes.count ?? 0,
      totalMinutes,
      activeUsers7d: activeUsers(7),
      activeUsers30d: activeUsers(30),
      signupsByWeek,
      minutesByWeek,
      topUniversidades: topBy(profiles, "universidad"),
      topCarreras: topBy(profiles, "carrera"),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}

function weekKey(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1); // lunes de esa semana
  return d.toISOString().slice(0, 10);
}

function bucketByWeek(items, weeks, getDate, getValue = () => 1) {
  const buckets = new Map();
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    buckets.set(weekKey(new Date(now.getTime() - i * 7 * 86400000)), 0);
  }
  for (const item of items) {
    const k = weekKey(getDate(item));
    if (buckets.has(k)) buckets.set(k, buckets.get(k) + getValue(item));
  }
  return Array.from(buckets.entries()).map(([week, value]) => ({ week, value }));
}

function topBy(profiles, field, n = 8) {
  const counts = new Map();
  for (const p of profiles) {
    const v = (p[field] || "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}
