import { requireAdmin } from "./_lib/requireAdmin.js";
import { getAdminClient } from "./_lib/adminClient.js";
import { fetchAllRows } from "./_lib/fetchAll.js";

// Pestaña "Asignaturas" del admin. Todo es lectura salvo el POST, que solo
// cambia las dos marcas de la asignatura canónica (is_erasmus / no_credits).
//   GET ?vista=carreras            -> carreras del catálogo ("Carrera · Universidad")
//   GET ?vista=carrera&id=<uuid>   -> asignaturas de esa carrera con sus cifras
//   GET ?vista=asignatura&id=<uuid>-> ficha: resumen, alias y usuarios
//   POST { id, campo, valor }      -> cambia una marca
const CAMPOS_MARCA = ["is_erasmus", "no_credits"];

const redondear = (n, d = 3) => (n == null ? null : +n.toFixed(d));

function mediana(valores) {
  if (valores.length === 0) return null;
  const s = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Reglas del bloque B: una canónica "excluida" (sin créditos o Erasmus) se
// muestra pero no entra en las medias del grupo por asignatura canónica.
const estaExcluida = (c) => c.no_credits === true || c.is_erasmus === true;

/** Cifras de cada usuario que tiene vinculada alguna de estas canónicas. */
async function cargarFilas(supabase, canonicaIds) {
  if (canonicaIds.length === 0) return [];
  const filas = await fetchAllRows(() =>
    supabase
      .from("asignaturas")
      .select("id, user_id, creditos, estado, asignatura_canonica_id, profiles(email)")
      .in("asignatura_canonica_id", canonicaIds)
  );
  const ids = filas.map((f) => f.id);
  const porAsignatura = new Map();
  // .in() con muchos ids revienta la URL: se trae por bloques.
  for (let i = 0; i < ids.length; i += 200) {
    const trozo = ids.slice(i, i + 200);
    const entradas = await fetchAllRows(() =>
      supabase.from("entradas_estudio").select("asignatura_id, minutos, fecha").in("asignatura_id", trozo)
    );
    for (const e of entradas) {
      const a = porAsignatura.get(e.asignatura_id) || { minutos: 0, sesiones: 0, ultima: null };
      a.minutos += e.minutos;
      a.sesiones += 1;
      if (!a.ultima || e.fecha > a.ultima) a.ultima = e.fecha;
      porAsignatura.set(e.asignatura_id, a);
    }
  }
  return filas.map((f) => {
    const a = porAsignatura.get(f.id) || { minutos: 0, sesiones: 0, ultima: null };
    return {
      userId: f.user_id,
      canonicaId: f.asignatura_canonica_id,
      email: f.profiles?.email ?? null,
      estado: f.estado,
      creditos: f.creditos,
      minutos: a.minutos,
      sesiones: a.sesiones,
      ultima: a.ultima,
      horasPorCredito: f.creditos > 0 ? redondear(a.minutos / 60 / f.creditos) : null,
    };
  });
}

function resumir(canonica, usuarios) {
  const excluida = estaExcluida(canonica);
  const minutos = usuarios.reduce((s, u) => s + u.minutos, 0);
  const ratios = excluida || !(canonica.creditos > 0)
    ? []
    : usuarios.map((u) => u.horasPorCredito).filter((v) => v != null);
  return {
    usuarios: usuarios.length,
    horasTotales: redondear(minutos / 60, 1),
    horasMediasPorUsuario: usuarios.length ? redondear(minutos / 60 / usuarios.length, 1) : null,
    mediaHorasPorCredito: ratios.length ? redondear(ratios.reduce((a, b) => a + b, 0) / ratios.length) : null,
    medianaHorasPorCredito: redondear(mediana(ratios)),
    minHorasPorCredito: ratios.length ? Math.min(...ratios) : null,
    maxHorasPorCredito: ratios.length ? Math.max(...ratios) : null,
    ultimaActividad: usuarios.reduce((m, u) => (u.ultima && (!m || u.ultima > m) ? u.ultima : m), null),
  };
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  const supabase = getAdminClient();

  try {
    if (req.method === "POST") {
      const { id, campo, valor } = req.body || {};
      if (!id) return res.status(400).json({ error: "Falta id." });
      if (!CAMPOS_MARCA.includes(campo)) return res.status(400).json({ error: "campo debe ser is_erasmus o no_credits." });
      if (typeof valor !== "boolean") return res.status(400).json({ error: "valor debe ser true o false." });
      const { error } = await supabase.from("asignaturas_canonicas").update({ [campo]: valor }).eq("id", id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const { vista, id } = req.query;

    if (vista === "carreras") {
      const carreras = await fetchAllRows(() =>
        supabase
          .from("carreras_canonicas")
          .select("id, nombre, universidades_canonicas(nombre)")
          .in("estado", ["pendiente", "aprobada"])
          .order("nombre")
      );
      return res.status(200).json({
        carreras: carreras.map((c) => ({ id: c.id, nombre: c.nombre, universidad: c.universidades_canonicas?.nombre ?? null })),
      });
    }

    if (!id || Array.isArray(id)) return res.status(400).json({ error: "Falta id." });

    if (vista === "carrera") {
      const canonicas = await fetchAllRows(() =>
        supabase
          .from("asignaturas_canonicas")
          .select("id, nombre_oficial, creditos, is_erasmus, no_credits")
          .eq("carrera_id", id)
          .in("estado", ["pendiente", "aprobada"])
      );
      const ids = canonicas.map((c) => c.id);
      const [filas, alias] = await Promise.all([
        cargarFilas(supabase, ids),
        ids.length
          ? fetchAllRows(() => supabase.from("asignaturas_alias").select("asignatura_id").in("asignatura_id", ids))
          : [],
      ]);
      const aliasPor = new Map();
      for (const a of alias) aliasPor.set(a.asignatura_id, (aliasPor.get(a.asignatura_id) || 0) + 1);
      return res.status(200).json({
        asignaturas: canonicas.map((c) => ({
          id: c.id,
          nombre: c.nombre_oficial,
          creditos: c.creditos,
          isErasmus: c.is_erasmus,
          noCredits: c.no_credits,
          excluida: estaExcluida(c),
          alias: aliasPor.get(c.id) || 0,
          ...resumir(c, filas.filter((f) => f.canonicaId === c.id)),
        })),
      });
    }

    if (vista === "asignatura") {
      const { data: c, error } = await supabase
        .from("asignaturas_canonicas")
        .select("id, nombre_oficial, creditos, is_erasmus, no_credits, carreras_canonicas(nombre, universidades_canonicas(nombre))")
        .eq("id", id)
        .single();
      if (error) throw error;
      const [usuarios, alias] = await Promise.all([
        cargarFilas(supabase, [id]),
        fetchAllRows(() => supabase.from("asignaturas_alias").select("texto_usuario").eq("asignatura_id", id)),
      ]);
      return res.status(200).json({
        asignatura: {
          id: c.id,
          nombre: c.nombre_oficial,
          creditos: c.creditos,
          isErasmus: c.is_erasmus,
          noCredits: c.no_credits,
          excluida: estaExcluida(c),
          carrera: c.carreras_canonicas?.nombre ?? null,
          universidad: c.carreras_canonicas?.universidades_canonicas?.nombre ?? null,
        },
        resumen: resumir(c, usuarios),
        alias: alias.map((a) => a.texto_usuario),
        usuarios,
      });
    }

    return res.status(400).json({ error: "vista debe ser carreras, carrera o asignatura." });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}
