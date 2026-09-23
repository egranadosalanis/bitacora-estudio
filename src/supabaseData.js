import { supabase } from "./supabaseClient";
import { buildEntriesFromLogs } from "./domain.js";

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

function rowToLog(r) {
  return {
    id: r.id,
    date: r.fecha,
    subjectId: r.asignatura_id,
    minutes: r.minutos,
    createdAt: r.created_at,
    deviceId: r.device_id,
    migrated: r.legacy_registro_id != null,
  };
}

// PostgREST devuelve como máximo 1000 filas por consulta; con una entrada
// por cada "Guardar" el historial supera eso enseguida, así que se pagina
// con .range() (orden estable por id) hasta traerlas todas.
const PAGE_SIZE = 1000;
async function fetchAllEntradas(userId) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("entradas_estudio")
      .select("*")
      .eq("user_id", userId)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

export async function loadUserData(userId) {
  const [cursosRes, asigRes, entradas] = await Promise.all([
    supabase.from("cursos").select("*").eq("user_id", userId),
    supabase.from("asignaturas").select("*").eq("user_id", userId),
    fetchAllEntradas(userId),
  ]);
  if (cursosRes.error) throw cursosRes.error;
  if (asigRes.error) throw asigRes.error;

  const cursos = cursosRes.data.map(rowToCurso);
  const subjects = asigRes.data.map(rowToSubject);
  const logs = entradas.map(rowToLog);

  return { schemaVersion: 3, activeCursoId: pickDefaultCursoId(cursos), cursos, subjects, logs, entries: buildEntriesFromLogs(logs) };
}

/* ---------- entradas_estudio ---------- */

/** Error que se lanza cuando la entrada a editar/borrar ya no existe (la
 * borró otro dispositivo). */
export class EntryNotFoundError extends Error {
  constructor() {
    super("Esa entrada ya no existe (probablemente se borró desde otro dispositivo).");
    this.name = "EntryNotFoundError";
  }
}

/** Añade entradas nuevas — nunca reescribe las existentes. Cada entrada
 * trae su id (UUID generado en el dispositivo): si un reintento manda otra
 * vez la misma entrada (p. ej. la red falló después de que el servidor la
 * aceptara), el id repetido se ignora y no se duplica. */
export async function insertEntries(userId, logs, deviceId) {
  const rows = logs.map((l) => ({
    id: l.id, user_id: userId, asignatura_id: l.subjectId, fecha: l.date, minutos: l.minutes, device_id: deviceId,
  }));
  const { error } = await supabase
    .from("entradas_estudio")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function updateEntryMinutes(userId, entryId, minutes) {
  const { data, error } = await supabase
    .from("entradas_estudio")
    .update({ minutos: minutes })
    .eq("user_id", userId)
    .eq("id", entryId)
    .select("id");
  if (error) throw error;
  if (data.length === 0) throw new EntryNotFoundError();
}

export async function deleteEntry(userId, entryId) {
  const { data, error } = await supabase
    .from("entradas_estudio")
    .delete()
    .eq("user_id", userId)
    .eq("id", entryId)
    .select("id");
  if (error) throw error;
  if (data.length === 0) throw new EntryNotFoundError();
}

/** Borra exactamente las entradas indicadas ("Eliminar día"): las mismas
 * que se enseñaron en la confirmación, ni una más aunque otro dispositivo
 * haya añadido alguna entretanto. */
export async function deleteEntries(userId, entryIds) {
  if (entryIds.length === 0) return;
  const { error } = await supabase
    .from("entradas_estudio")
    .delete()
    .eq("user_id", userId)
    .in("id", entryIds);
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

/* ---------- migración desde Google Sheets (uso único) ---------- */

/** Sube a Supabase, bajo `userId`, un bloque de datos ya en la forma
 * { cursos, subjects, entries } (la misma que devuelve migrateData() +
 * applyHistoricalImport() de domain.js) — se usa una sola vez por cuenta,
 * para traer el historial que hasta ahora vivía en Google Sheets. Nunca
 * toca ni borra el origen. */
export async function migrateFromGoogleSheets(userId, legacyData, onProgress) {
  const report = (msg) => onProgress && onProgress(msg);

  const cursoIdMap = {};
  report(`Creando ${legacyData.cursos.length} curso(s)...`);
  for (const c of legacyData.cursos) {
    const { data, error } = await supabase
      .from("cursos")
      .insert({ user_id: userId, name: c.name, start_date: c.startDate, end_date: c.endDate, estado: c.estado })
      .select()
      .single();
    if (error) throw error;
    cursoIdMap[c.id] = data.id;
  }

  const subjectIdMap = {};
  report(`Creando ${legacyData.subjects.length} asignatura(s)...`);
  for (const s of legacyData.subjects) {
    const { data, error } = await supabase
      .from("asignaturas")
      .insert({
        user_id: userId,
        nombre: s.name,
        creditos: s.credits,
        target: s.target,
        color: s.color,
        estado: s.estado,
        origin_curso_id: s.originCursoId ? (cursoIdMap[s.originCursoId] ?? null) : null,
        frozen_nota: s.frozen?.nota ?? null,
        frozen_cursos_necesarios: s.frozen?.cursosNecesarios ?? null,
        frozen_fecha_aprobacion: s.frozen?.fechaAprobacion ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    subjectIdMap[s.id] = data.id;
  }

  // Segunda pasada: "Combinar con" (mergedInto) referencia a otra
  // asignatura que ya tiene que existir como fila, así que se enlaza
  // después de haberlas creado todas.
  const withMerge = legacyData.subjects.filter((s) => s.mergedInto);
  if (withMerge.length > 0) report("Enlazando asignaturas combinadas...");
  for (const s of withMerge) {
    const target = subjectIdMap[s.mergedInto];
    if (!target) continue;
    const { error } = await supabase
      .from("asignaturas")
      .update({ asignatura_equivalente_id: target })
      .eq("id", subjectIdMap[s.id]);
    if (error) throw error;
  }

  const rows = [];
  Object.entries(legacyData.entries).forEach(([fecha, bySubject]) => {
    Object.entries(bySubject).forEach(([subId, minutos]) => {
      if (!minutos || !subjectIdMap[subId]) return;
      rows.push({ user_id: userId, asignatura_id: subjectIdMap[subId], fecha, minutos: Math.round(minutos) });
    });
  });
  report(`Subiendo ${rows.length} registros de estudio...`);
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from("entradas_estudio").insert(rows.slice(i, i + BATCH));
    if (error) throw error;
  }

  return { cursos: legacyData.cursos.length, subjects: legacyData.subjects.length, registros: rows.length };
}

/* ---------- borrar cuenta ---------- */

/** Borra la fila de `profiles` del usuario — el esquema tiene `on delete
 * cascade` desde cursos/asignaturas/registros_estudio/entradas_estudio hacia profiles, así
 * que esto se lleva por delante todos sus datos de un tirón. Requiere la
 * política RLS "profiles_delete_own" (ver supabase/migrations). */
export async function deleteAccountData(userId) {
  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) throw error;
}
