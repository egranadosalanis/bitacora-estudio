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
    asignaturaCanonicaId: s.asignatura_canonica_id,
    esErasmus: s.es_erasmus,
    canonicalEstado: s.asignaturas_canonicas?.estado ?? null,
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
    supabase.from("asignaturas").select("*, asignaturas_canonicas(estado)").eq("user_id", userId),
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

/* ---------- asignaturas ---------- */

export async function insertSubject(userId, { name, credits, color, originCursoId, asignaturaCanonicaId = null, esErasmus = false }) {
  const { data, error } = await supabase
    .from("asignaturas")
    .insert({
      user_id: userId, nombre: name, creditos: credits, color, origin_curso_id: originCursoId, estado: "en_curso",
      asignatura_canonica_id: asignaturaCanonicaId, es_erasmus: esErasmus,
    })
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
  asignaturaCanonicaId: "asignatura_canonica_id",
  esErasmus: "es_erasmus",
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

/* ---------- normalización: búsqueda ---------- */

export async function searchUniversidades(query, { limit = 20 } = {}) {
  const { data, error } = await supabase.rpc("buscar_universidades", { p_query: query ?? "", p_limite: limit });
  if (error) throw error;
  return data;
}

export async function searchCarreras(universidadId, query, { limit = 20 } = {}) {
  const { data, error } = await supabase.rpc("buscar_carreras", {
    p_universidad_id: universidadId, p_query: query ?? "", p_limite: limit,
  });
  if (error) throw error;
  return data;
}

export async function searchAsignaturasCanonicas(carreraId, query, { limit = 20 } = {}) {
  const { data, error } = await supabase.rpc("buscar_asignaturas_canonicas", {
    p_carrera_id: carreraId, p_query: query ?? "", p_limite: limit,
  });
  if (error) throw error;
  return data;
}

/* ---------- normalización: alta de fila "pendiente" ---------- */

export async function createUniversidadPendiente(nombre, pais = null) {
  const { data, error } = await supabase.rpc("crear_universidad_pendiente", { p_nombre: nombre, p_pais: pais });
  if (error) throw error;
  return data;
}

export async function createCarreraPendiente(universidadId, nombre) {
  const { data, error } = await supabase.rpc("crear_carrera_pendiente", {
    p_universidad_id: universidadId, p_nombre: nombre,
  });
  if (error) throw error;
  return data;
}

export async function createAsignaturaPendiente(carreraId, nombre, creditos) {
  const { data, error } = await supabase.rpc("crear_asignatura_pendiente", {
    p_carrera_id: carreraId, p_nombre: nombre, p_creditos: creditos,
  });
  if (error) throw error;
  return data;
}

/* ---------- normalización: enlazar ---------- */

export async function linkProfileToCanonical(userId, { universidadId, carreraId }) {
  const { error } = await supabase
    .from("profiles")
    .update({ universidad_canonica_id: universidadId, carrera_canonica_id: carreraId })
    .eq("id", userId);
  if (error) throw error;
}

export async function linkAsignaturaToCanonical(userId, subjectId, asignaturaCanonicaId) {
  const { error } = await supabase
    .from("asignaturas")
    .update({ asignatura_canonica_id: asignaturaCanonicaId, es_erasmus: false })
    .eq("user_id", userId)
    .eq("id", subjectId);
  if (error) throw error;
}

export async function markAsignaturaErasmus(userId, subjectId, isErasmus = true) {
  const { error } = await supabase
    .from("asignaturas")
    .update({ es_erasmus: isErasmus, asignatura_canonica_id: null })
    .eq("user_id", userId)
    .eq("id", subjectId);
  if (error) throw error;
}

/* ---------- normalización: estado de la migración ---------- */

/** Todo lo que hace falta para saber si a `userId` le queda algo por
 * vincular: si su universidad/carrera no están enlazadas a una fila
 * canónica, o si tiene alguna asignatura (de cualquier curso, no solo
 * el activo) sin vincular y sin marcar como Erasmus. `done` es lo que
 * decide si la pantalla de migración obligatoria deja pasar al
 * usuario — se recalcula siempre desde estos datos, nunca desde un
 * flag guardado (ver informe de normalización). */
export async function getNormalizationStatus(userId) {
  const [{ data: profile, error: profileError }, { data: subjectRows, error: subjectsError }, { data: cursoRows, error: cursosError }] =
    await Promise.all([
      supabase.from("profiles").select("universidad_canonica_id, carrera_canonica_id").eq("id", userId).single(),
      supabase
        .from("asignaturas")
        .select("id, nombre, creditos, origin_curso_id, es_erasmus, asignatura_canonica_id, asignaturas_canonicas(estado)")
        .eq("user_id", userId),
      supabase.from("cursos").select("id, name").eq("user_id", userId),
    ]);
  if (profileError) throw profileError;
  if (subjectsError) throw subjectsError;
  if (cursosError) throw cursosError;

  const cursoNameById = new Map(cursoRows.map((c) => [c.id, c.name]));
  const subjects = subjectRows.map((s) => ({
    id: s.id,
    name: s.nombre,
    credits: s.creditos,
    cursoId: s.origin_curso_id,
    cursoName: cursoNameById.get(s.origin_curso_id) ?? null,
    esErasmus: s.es_erasmus,
    asignaturaCanonicaId: s.asignatura_canonica_id,
    canonicalEstado: s.asignaturas_canonicas?.estado ?? null,
  }));

  const profileLinked = Boolean(profile.universidad_canonica_id && profile.carrera_canonica_id);
  const pendingSubjects = subjects.filter((s) => !s.asignaturaCanonicaId && !s.esErasmus);
  const rejectedSubjects = subjects.filter((s) => s.canonicalEstado === "rechazada");

  return {
    profileLinked,
    universidadCanonicaId: profile.universidad_canonica_id,
    carreraCanonicaId: profile.carrera_canonica_id,
    pendingSubjects,
    rejectedSubjects,
    done: profileLinked && pendingSubjects.length === 0,
  };
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
