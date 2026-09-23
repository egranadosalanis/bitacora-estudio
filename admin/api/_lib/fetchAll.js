// PostgREST (la API que usa Supabase) devuelve como máximo 1000 filas por
// consulta aunque no pongas límite explícito. entradas_estudio acumula una
// fila por cada "Guardar", así que cualquier cuenta con varios años de
// historial (o la suma de todos los usuarios) supera ese límite enseguida —
// y las filas que se quedan fuera son summary/agregados que nunca se
// actualizan con lo último, aunque los datos sí se guardaran bien. Esto pagina
// con .range() hasta traerlas todas.
const PAGE_SIZE = 1000;

export async function fetchAllRows(buildQuery) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}
