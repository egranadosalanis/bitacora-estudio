import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  Traduce entre las tablas de Supabase y la forma en memoria         */
/*  { cursos, subjects, entries } que ya usa toda la app (domain.js,   */
/*  App.jsx) — así el resto del código no cambia nada.                 */
/* ------------------------------------------------------------------ */

function rowToCurso(c) {
  return { id: c.id, name: c.name, startDate: c.start_date, endDate: c.end_date, estado: c.estado };
}

function rowToSubject(s) {
  return {
    id: s.id,
    name: s.nombre,
    credits: s.creditos,
    target: s.target,
    color: s.color,
    estado: s.estado,
    mergedInto: s.asignatura_equivalente_id,
    originCursoId: s.origin_curso_id,
    frozen: s.estado === "aprobada"
      ? { nota: s.frozen_nota, cursosNecesarios: s.frozen_cursos_necesarios, fechaAprobacion: s.frozen_fecha_aprobacion }
      : null,
  };
}

/** El curso "en_curso" si hay uno; si no, el de fecha de inicio más reciente. */
function pickDefaultCursoId(cursos) {
  const enCurso = cursos.find((c) => c.estado === "en_curso");
  if (enCurso) return enCurso.id;
  const sorted = [...cursos].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  return sorted[0]?.id ?? null;
}

export async function loadUserData(userId) {
  const [cursosRes, asigRes, regRes] = await Promise.all([
    supabase.from("cursos").select("*").eq("user_id", userId),
    supabase.from("asignaturas").select("*").eq("user_id", userId),
    supabase.from("registros_estudio").select("*").eq("user_id", userId),
  ]);
  if (cursosRes.error) throw cursosRes.error;
  if (asigRes.error) throw asigRes.error;
  if (regRes.error) throw regRes.error;

  const cursos = cursosRes.data.map(rowToCurso);
  const subjects = asigRes.data.map(rowToSubject);
  const entries = {};
  regRes.data.forEach((r) => {
    if (!entries[r.fecha]) entries[r.fecha] = {};
    entries[r.fecha][r.asignatura_id] = r.minutos;
  });

  return { schemaVersion: 3, activeCursoId: pickDefaultCursoId(cursos), cursos, subjects, entries };
}

/* ---------- registros_estudio ---------- */

export async function saveDayEntries(userId, date, loggableIds, values) {
  const keepIds = new Set(Object.keys(values));
  const toDeleteIds = loggableIds.filter((id) => !keepIds.has(id));
  if (toDeleteIds.length > 0) {
    const { error } = await supabase
      .from("registros_estudio")
      .delete()
      .eq("user_id", userId)
      .eq("fecha", date)
      .in("asignatura_id", toDeleteIds);
    if (error) throw error;
  }
  const toUpsert = Object.entries(values).map(([asignatura_id, minutos]) => ({
    user_id: userId, asignatura_id, fecha: date, minutos: Math.round(minutos),
  }));
  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("registros_estudio")
      .upsert(toUpsert, { onConflict: "asignatura_id,fecha" });
    if (error) throw error;
  }
}

export async function deleteDayEntries(userId, date, loggableIds) {
  const { error } = await supabase
    .from("registros_estudio")
    .delete()
    .eq("user_id", userId)
    .eq("fecha", date)
    .in("asignatura_id", loggableIds);
  if (error) throw error;
}

/* ---------- asignaturas ---------- */

export async function insertSubject(userId, { name, credits, color, originCursoId }) {
  const { data, error } = await supabase
    .from("asignaturas")
    .insert({ user_id: userId, nombre: name, creditos: credits, color, origin_curso_id: originCursoId, estado: "en_curso" })
    .select()
    .single();
  if (error) throw error;
  return rowToSubject(data);
}

export async function deleteSubject(userId, subjectId) {
  const { error } = await supabase.from("asignaturas").delete().eq("user_id", userId).eq("id", subjectId);
  if (error) throw error;
}

const SUBJECT_PATCH_TO_COLUMN = {
  name: "nombre",
  credits: "creditos",
  target: "target",
  color: "color",
  mergedInto: "asignatura_equivalente_id",
};

export async function updateSubject(userId, subjectId, patch) {
  const row = {};
  Object.entries(patch).forEach(([key, value]) => {
    const column = SUBJECT_PATCH_TO_COLUMN[key];
    if (column) row[column] = value;
  });
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from("asignaturas").update(row).eq("user_id", userId).eq("id", subjectId);
  if (error) throw error;
}

export async function updateSubjectEstado(userId, subjectId, estado) {
  const row = { estado };
  if (estado !== "aprobada") {
    row.frozen_nota = null;
    row.frozen_cursos_necesarios = null;
    row.frozen_fecha_aprobacion = null;
  }
  const { error } = await supabase.from("asignaturas").update(row).eq("user_id", userId).eq("id", subjectId);
  if (error) throw error;
}

export async function approveSubject(userId, subjectId, { nota, cursosNecesarios, fechaAprobacion }) {
  const { error } = await supabase
    .from("asignaturas")
    .update({ estado: "aprobada", frozen_nota: nota, frozen_cursos_necesarios: cursosNecesarios, frozen_fecha_aprobacion: fechaAprobacion })
    .eq("user_id", userId)
    .eq("id", subjectId);
  if (error) throw error;
}

/* ---------- cursos ---------- */

export async function insertCurso(userId, { name, startDate, endDate }) {
  const { data, error } = await supabase
    .from("cursos")
    .insert({ user_id: userId, name, start_date: startDate, end_date: endDate, estado: "en_curso" })
    .select()
    .single();
  if (error) throw error;
  return rowToCurso(data);
}

export async function updateCursoEstado(userId, cursoId, estado) {
  const { error } = await supabase.from("cursos").update({ estado }).eq("user_id", userId).eq("id", cursoId);
  if (error) throw error;
}

export async function deleteCurso(userId, cursoId) {
  const { error } = await supabase.from("cursos").delete().eq("user_id", userId).eq("id", cursoId);
  if (error) throw error;
}
