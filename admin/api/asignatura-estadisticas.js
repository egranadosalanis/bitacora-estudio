import { requireAdmin } from "./_lib/requireAdmin.js";
import { getAdminClient } from "./_lib/adminClient.js";
import { fetchAllRows } from "./_lib/fetchAll.js";

// Para una asignatura canónica, cifras comparables entre todos los
// estudiantes que la tienen vinculada (nunca las marcadas Erasmus, que se
// quedan siempre fuera de la normalización): minutos totales y horas/crédito
// de cada uno (misma fórmula que "Clasificación" en la app: minutos/60/creditos),
// más la media, para poder ver quién va holgado o apurado respecto al resto.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireAdmin(req);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const { asignaturaCanonicaId } = req.query;
  if (!asignaturaCanonicaId || Array.isArray(asignaturaCanonicaId)) {
    return res.status(400).json({ error: "Falta el parámetro asignaturaCanonicaId." });
  }

  const supabase = getAdminClient();

  try {
    const { data: canonica, error: canonicaError } = await supabase
      .from("asignaturas_canonicas")
      .select("id, nombre_oficial, creditos, carreras_canonicas(nombre, universidades_canonicas(nombre))")
      .eq("id", asignaturaCanonicaId)
      .single();
    if (canonicaError) throw canonicaError;

    const { data: filas, error: filasError } = await supabase
      .from("asignaturas")
      .select("id, user_id, creditos, estado, profiles(email)")
      .eq("asignatura_canonica_id", asignaturaCanonicaId);
    if (filasError) throw filasError;

    const asignaturaIds = filas.map((f) => f.id);
    const minutosPorAsignatura = new Map();
    if (asignaturaIds.length > 0) {
      const entradas = await fetchAllRows(() =>
        supabase.from("entradas_estudio").select("asignatura_id, minutos").in("asignatura_id", asignaturaIds)
      );
      for (const e of entradas) {
        minutosPorAsignatura.set(e.asignatura_id, (minutosPorAsignatura.get(e.asignatura_id) || 0) + e.minutos);
      }
    }

    const estudiantes = filas
      .map((f) => {
        const minutosTotal = minutosPorAsignatura.get(f.id) || 0;
        const horasPorCredito = f.creditos > 0 ? +(minutosTotal / 60 / f.creditos).toFixed(3) : null;
        return {
          email: f.profiles?.email ?? null,
          estado: f.estado,
          creditos: f.creditos,
          minutosTotal,
          horasPorCredito,
        };
      })
      .sort((a, b) => (b.horasPorCredito ?? -1) - (a.horasPorCredito ?? -1));

    const conCifra = estudiantes.filter((e) => e.horasPorCredito != null);
    const media = conCifra.length > 0
      ? +(conCifra.reduce((s, e) => s + e.horasPorCredito, 0) / conCifra.length).toFixed(3)
      : null;
    const valores = conCifra.map((e) => e.horasPorCredito);

    res.status(200).json({
      asignatura: {
        nombre: canonica.nombre_oficial,
        creditos: canonica.creditos,
        carrera: canonica.carreras_canonicas?.nombre ?? null,
        universidad: canonica.carreras_canonicas?.universidades_canonicas?.nombre ?? null,
      },
      resumen: {
        estudiantes: estudiantes.length,
        mediaHorasPorCredito: media,
        minHorasPorCredito: valores.length > 0 ? Math.min(...valores) : null,
        maxHorasPorCredito: valores.length > 0 ? Math.max(...valores) : null,
      },
      estudiantes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
