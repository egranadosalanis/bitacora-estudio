/* ------------------------------------------------------------------ */
/*  EXPORTACIÓN A EXCEL (función premium)                              */
/*                                                                      */
/*  Genera un .xlsx con el mismo espíritu que los Excel de horas de     */
/*  estudio que el usuario llevaba a mano antes de esta app: una tabla  */
/*  de registros diarios, un resumen por asignatura con fórmulas reales */
/*  (no solo números fijos, para que se puedan tocar los datos y todo   */
/*  se recalcule solo), la clasificación histórica de las asignaturas   */
/*  aprobadas y la evolución acumulada de horas en el tiempo — cada una */
/*  con su gráfica. ExcelJS y Chart.js se cargan de forma perezosa      */
/*  (import dinámico) porque solo hacen falta al pulsar "Exportar".     */
/* ------------------------------------------------------------------ */

import {
  parseISO, formatMedium, daysBetween,
  computeStats, getAllEntriesFlat, computeDesgaste, computeClassification,
} from "./domain.js";

const ESTADO_LABELS = { en_curso: "En curso", suspendida: "Suspendida", aprobada: "Aprobada" };

// Con años de historial acumulado el número de asignaturas puede crecer
// bastante — sin este límite las barras se vuelven ilegibles y la leyenda
// de la de tarta se sale del lienzo. La tabla de la hoja (con fórmulas)
// siempre lleva el detalle completo; la gráfica es solo un vistazo rápido.
const MAX_CHART_SLICES = 14;

/** Recorta `items` (ya ordenados de mayor a menor por `value`) a los
 * MAX_CHART_SLICES-1 primeros + una entrada "Otras" con el resto sumado
 * (solo si hace falta), para gráficas de tarta con leyenda. */
function topWithOthers(items, getValue, max = MAX_CHART_SLICES) {
  if (items.length <= max) return items.map((it) => ({ name: it.name, value: getValue(it), color: it.color }));
  const head = items.slice(0, max - 1).map((it) => ({ name: it.name, value: getValue(it), color: it.color }));
  const restValue = items.slice(max - 1).reduce((a, it) => a + getValue(it), 0);
  return [...head, { name: `Otras (${items.length - (max - 1)})`, value: restValue, color: "#94A3B8" }];
}

const FONT = "Calibri";
const HEADER_FILL = "FF1F2A3D";
const HEADER_FONT = "FFFFFFFF";
const BAND_FILL = "FFF3F5F9";
const TOTAL_FILL = "FFE7ECF5";
const BORDER = { style: "thin", color: { argb: "FFD7DEE8" } };

function headerRow(sheet, row, labels) {
  const r = sheet.getRow(row);
  labels.forEach((label, i) => {
    const cell = r.getCell(i + 1);
    cell.value = label;
    cell.font = { name: FONT, bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle" };
    cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  });
  r.commit();
}

function bandRow(sheet, rowNumber, colCount, shade) {
  if (!shade) return;
  const r = sheet.getRow(rowNumber);
  for (let c = 1; c <= colCount; c++) {
    const cell = r.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND_FILL } };
  }
}

function borderRow(sheet, rowNumber, colCount) {
  const r = sheet.getRow(rowNumber);
  for (let c = 1; c <= colCount; c++) {
    r.getCell(c).border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  }
}

function cursoNameForDate(cursos, date) {
  const c = cursos.find((c) => c.startDate && c.endDate && date >= c.startDate && date <= c.endDate);
  return c ? c.name : "—";
}

/** Convierte una fecha ISO "AAAA-MM-DD" en un Date "puro" (medianoche UTC)
 * — igual criterio de fechas que el resto de la app (ver domain.js). */
function excelDate(iso) {
  return parseISO(iso);
}

/* ------------------------------------------------------------------ */
/*  GRÁFICAS: se renderizan con Chart.js sobre un <canvas> en memoria   */
/*  (nunca se añade al DOM) y se incrustan como imagen PNG — ExcelJS no */
/*  soporta gráficas nativas de Excel, pero el resultado visual es el   */
/*  mismo que pegar una gráfica en un Excel a mano.                     */
/* ------------------------------------------------------------------ */

async function renderChartPNG(ChartJS, config, width = 720, height = 380) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const chart = new ChartJS(canvas.getContext("2d"), {
    ...config,
    options: {
      ...config.options,
      responsive: false,
      animation: false,
      devicePixelRatio: 2,
      plugins: {
        ...(config.options && config.options.plugins),
        legend: { ...(config.options?.plugins?.legend), labels: { color: "#1F2A3D", font: { size: 12 } } },
      },
    },
  });
  // Chart.js dibuja de forma síncrona al desactivar animation, pero se le
  // da un tick de margen para asegurar que el canvas ya tiene los píxeles
  // antes de leerlo con toDataURL.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const dataUrl = canvas.toDataURL("image/png");
  chart.destroy();
  return { dataUrl, width, height };
}

async function addChartImage(workbook, sheet, ChartJS, config, anchorCell, size) {
  const { dataUrl, width, height } = await renderChartPNG(ChartJS, config, size?.width, size?.height);
  const imageId = workbook.addImage({ base64: dataUrl, extension: "png" });
  sheet.addImage(imageId, { tl: anchorCell, ext: { width, height } });
}

const CHART_BASE_OPTIONS = {
  plugins: { title: { display: false } },
  scales: {
    x: { ticks: { color: "#1F2A3D", font: { size: 11 } }, grid: { color: "#E4E9F1" } },
    y: { ticks: { color: "#1F2A3D", font: { size: 11 } }, grid: { color: "#E4E9F1" }, beginAtZero: true },
  },
};

/* ------------------------------------------------------------------ */
/*  HOJA 1 — RESUMEN                                                    */
/* ------------------------------------------------------------------ */

function buildResumenSheet(workbook, { subjects, entries }) {
  const sheet = workbook.addWorksheet("Resumen", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { width: 32 }, { width: 14 }, { width: 10 }, { width: 14 },
    { width: 12 }, { width: 13 }, { width: 12 }, { width: 12 },
    { width: 14 }, { width: 14 },
  ];
  headerRow(sheet, 1, [
    "Asignatura", "Estado", "Créditos", "Horas totales",
    "% esfuerzo", "Horas / crédito", "Días activos", "Último registro",
    "Desgaste (0-10)", "Nivel de desgaste",
  ]);

  const stats = computeStats(subjects, entries);
  const ordered = [...stats.perSubject].sort((a, b) => b.total - a.total);
  const firstDataRow = 2;

  ordered.forEach((s, i) => {
    const row = firstDataRow + i;
    const r = sheet.getRow(row);
    const d = computeDesgaste(s.id, entries);
    r.getCell(1).value = s.name;
    r.getCell(2).value = ESTADO_LABELS[s.estado] || s.estado;
    r.getCell(3).value = s.credits;
    // Horas totales — fórmula real sobre la hoja "Registros diarios",
    // para que si el usuario retoca los minutos ahí, el resumen se
    // recalcule solo, igual que en un Excel hecho a mano.
    r.getCell(4).value = { formula: `SUMIF('Registros diarios'!$B:$B,A${row},'Registros diarios'!$E:$E)` };
    r.getCell(4).numFmt = "0.00";
    r.getCell(5).value = { formula: `IF($D$${firstDataRow + ordered.length}=0,0,D${row}/$D$${firstDataRow + ordered.length})` };
    r.getCell(5).numFmt = "0.0%";
    r.getCell(6).value = { formula: `IF(C${row}=0,0,D${row}/C${row})` };
    r.getCell(6).numFmt = "0.00";
    r.getCell(7).value = { formula: `COUNTIFS('Registros diarios'!$B:$B,A${row},'Registros diarios'!$D:$D,">0")` };
    r.getCell(8).value = s.last
      ? { formula: `MAXIFS('Registros diarios'!$A:$A,'Registros diarios'!$B:$B,A${row})` }
      : "—";
    if (s.last) r.getCell(8).numFmt = "dd/mm/yyyy";
    r.getCell(9).value = d.comparable ? d.indice : "—";
    r.getCell(10).value = d.comparable ? d.etiqueta : "Sin datos suficientes";
    bandRow(sheet, row, 10, i % 2 === 1);
    borderRow(sheet, row, 10);
    r.commit();
  });

  const totalRow = firstDataRow + ordered.length;
  const tr = sheet.getRow(totalRow);
  tr.getCell(1).value = "Total";
  tr.getCell(1).font = { bold: true };
  tr.getCell(3).value = { formula: `SUM(C${firstDataRow}:C${totalRow - 1})` };
  tr.getCell(4).value = { formula: `SUM(D${firstDataRow}:D${totalRow - 1})` };
  tr.getCell(4).numFmt = "0.00";
  tr.getCell(5).value = { formula: `SUM(E${firstDataRow}:E${totalRow - 1})` };
  tr.getCell(5).numFmt = "0.0%";
  for (let c = 1; c <= 10; c++) {
    tr.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
    tr.getCell(c).border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  }
  tr.commit();

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: totalRow - 1, column: 10 } };

  return { sheet, ordered, totalRow };
}

/* ------------------------------------------------------------------ */
/*  HOJA 2 — REGISTROS DIARIOS                                         */
/* ------------------------------------------------------------------ */

function buildRegistrosSheet(workbook, { subjects, entries, cursos }) {
  const sheet = workbook.addWorksheet("Registros diarios", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [{ width: 13 }, { width: 32 }, { width: 14 }, { width: 12 }, { width: 12 }];
  headerRow(sheet, 1, ["Fecha", "Asignatura", "Curso", "Minutos", "Horas"]);

  const flat = getAllEntriesFlat(subjects, entries, "asc");
  flat.forEach((e, i) => {
    const row = i + 2;
    const r = sheet.getRow(row);
    r.getCell(1).value = excelDate(e.date);
    r.getCell(1).numFmt = "dd/mm/yyyy";
    r.getCell(2).value = e.subjectName;
    r.getCell(3).value = cursoNameForDate(cursos, e.date);
    r.getCell(4).value = e.minutes;
    r.getCell(5).value = { formula: `D${row}/60` };
    r.getCell(5).numFmt = "0.00";
    bandRow(sheet, row, 5, i % 2 === 1);
    r.commit();
  });

  const lastRow = flat.length + 1;
  if (flat.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastRow, column: 5 } };
  }
  return { sheet, flat };
}

/* ------------------------------------------------------------------ */
/*  HOJA 3 — CLASIFICACIÓN HISTÓRICA (solo asignaturas aprobadas)      */
/* ------------------------------------------------------------------ */

function buildClasificacionSheet(workbook, { subjects, entries }) {
  const approved = subjects.filter((s) => s.estado === "aprobada" && s.frozen);
  if (approved.length === 0) return null;

  const sheet = workbook.addWorksheet("Clasificación histórica", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { width: 32 }, { width: 10 }, { width: 8 }, { width: 14 },
    { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 },
  ];
  headerRow(sheet, 1, [
    "Asignatura", "Créditos", "Nota", "Horas / crédito",
    "Días totales", "Fecha inicio", "Fecha aprobación", "Cursos necesarios",
  ]);

  const rows = approved
    .map((s) => ({ s, c: computeClassification(s, entries, subjects) }))
    .sort((a, b) => b.c.horasPorCredito - a.c.horasPorCredito);

  rows.forEach(({ s, c }, i) => {
    const row = i + 2;
    const r = sheet.getRow(row);
    r.getCell(1).value = s.name;
    r.getCell(2).value = s.credits;
    r.getCell(3).value = s.frozen.nota ?? null;
    r.getCell(4).value = c.horasPorCredito;
    r.getCell(4).numFmt = "0.00";
    r.getCell(5).value = c.diasTotales;
    r.getCell(6).value = c.fechaInicio ? excelDate(c.fechaInicio) : null;
    if (c.fechaInicio) r.getCell(6).numFmt = "dd/mm/yyyy";
    r.getCell(7).value = excelDate(s.frozen.fechaAprobacion);
    r.getCell(7).numFmt = "dd/mm/yyyy";
    r.getCell(8).value = s.frozen.cursosNecesarios ?? null;
    bandRow(sheet, row, 8, i % 2 === 1);
    borderRow(sheet, row, 8);
    r.commit();
  });

  return { sheet, rows };
}

/* ------------------------------------------------------------------ */
/*  HOJA 4 — EVOLUCIÓN (horas acumuladas en el tiempo, por semanas)     */
/* ------------------------------------------------------------------ */

function buildEvolucionSheet(workbook, { entries }) {
  const dates = Object.keys(entries).filter((d) => Object.values(entries[d]).some((m) => m > 0)).sort();
  if (dates.length === 0) return null;

  const start = dates[0];
  const totalsByDate = {};
  dates.forEach((d) => {
    totalsByDate[d] = Object.values(entries[d]).reduce((a, m) => a + (m > 0 ? m : 0), 0);
  });

  const end = dates[dates.length - 1];
  const numWeeks = Math.floor(daysBetween(start, end) / 7) + 1;
  const weekMinutes = Array.from({ length: numWeeks }, () => 0);
  dates.forEach((d) => {
    const idx = Math.floor(daysBetween(start, d) / 7);
    weekMinutes[idx] += totalsByDate[d];
  });

  const sheet = workbook.addWorksheet("Evolución", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [{ width: 14 }, { width: 14 }, { width: 16 }];
  headerRow(sheet, 1, ["Semana desde", "Horas esa semana", "Horas acumuladas"]);

  weekMinutes.forEach((minutes, i) => {
    const row = i + 2;
    const r = sheet.getRow(row);
    r.getCell(1).value = excelDate(addDaysLocal(start, i * 7));
    r.getCell(1).numFmt = "dd/mm/yyyy";
    r.getCell(2).value = +(minutes / 60).toFixed(2);
    r.getCell(2).numFmt = "0.00";
    r.getCell(3).value = i === 0 ? { formula: `B${row}` } : { formula: `C${row - 1}+B${row}` };
    r.getCell(3).numFmt = "0.00";
    bandRow(sheet, row, 3, i % 2 === 1);
    r.commit();
  });

  return { sheet, weekMinutes, start, numWeeks };
}

function addDaysLocal(iso, n) {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  ENSAMBLADO + DESCARGA                                               */
/* ------------------------------------------------------------------ */

function triggerDownload(buffer, filename) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Construye el libro de Excel de asignaturas y devuelve su buffer, sin
 * descargarlo — separado de exportSubjectsToExcel para poder probar la
 * generación (formulas, hojas, gráficas) sin depender de un click real
 * del navegador.
 */
export async function buildSubjectsWorkbookBuffer(data) {
  const [{ default: ExcelJS }, { Chart: ChartJS, registerables }] = await Promise.all([
    import("exceljs"),
    import("chart.js"),
  ]);
  ChartJS.register(...registerables);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bitácora de estudio";
  workbook.created = new Date();
  // Las celdas de fórmula se escriben sin valor cacheado — sin esto, algunas
  // apps de hoja de cálculo las muestran en blanco hasta que se recalculan
  // a mano (Ctrl+Alt+F9). Con fullCalcOnLoad, Excel/Sheets/LibreOffice
  // recalculan todo nada más abrir el archivo.
  workbook.calcProperties.fullCalcOnLoad = true;

  const { subjects, entries, cursos } = data;

  const { sheet: resumenSheet, ordered } = buildResumenSheet(workbook, { subjects, entries });
  buildRegistrosSheet(workbook, { subjects, entries, cursos });
  const clasifResult = buildClasificacionSheet(workbook, { subjects, entries });
  const evolResult = buildEvolucionSheet(workbook, { entries });

  const withHours = ordered.filter((s) => s.total > 0);
  if (withHours.length > 0) {
    const slices = topWithOthers(withHours, (s) => +(s.total / 60).toFixed(2));
    await addChartImage(
      workbook, resumenSheet, ChartJS,
      {
        type: "bar",
        data: {
          labels: slices.map((s) => s.name),
          datasets: [{ label: "Horas totales", data: slices.map((s) => s.value), backgroundColor: slices.map((s) => s.color) }],
        },
        options: { ...CHART_BASE_OPTIONS, plugins: { legend: { display: false } } },
      },
      { col: 11, row: 1 }
    );
    await addChartImage(
      workbook, resumenSheet, ChartJS,
      {
        type: "pie",
        data: {
          labels: slices.map((s) => s.name),
          datasets: [{ data: slices.map((s) => s.value), backgroundColor: slices.map((s) => s.color) }],
        },
        options: { plugins: { legend: { position: "right" } } },
      },
      { col: 11, row: 21 },
      { width: 720, height: 420 }
    );
  }

  if (clasifResult && clasifResult.rows.length > 0) {
    const { sheet: clasifSheet, rows } = clasifResult;
    const barRows = rows.length > MAX_CHART_SLICES ? rows.slice(0, MAX_CHART_SLICES) : rows;
    await addChartImage(
      workbook, clasifSheet, ChartJS,
      {
        type: "bar",
        data: {
          labels: barRows.map((r) => r.s.name),
          datasets: [{ label: "Horas / crédito", data: barRows.map((r) => +r.c.horasPorCredito.toFixed(2)), backgroundColor: barRows.map((r) => r.s.color) }],
        },
        options: { ...CHART_BASE_OPTIONS, plugins: { legend: { display: false } } },
      },
      { col: 10, row: 1 }
    );
  }

  if (evolResult) {
    const { sheet: evolSheet, weekMinutes, start } = evolResult;
    let acc = 0;
    const cumulative = weekMinutes.map((m) => (acc += m / 60));
    await addChartImage(
      workbook, evolSheet, ChartJS,
      {
        type: "line",
        data: {
          labels: weekMinutes.map((_, i) => formatMedium(addDaysLocal(start, i * 7))),
          datasets: [{ label: "Horas acumuladas", data: cumulative.map((v) => +v.toFixed(2)), borderColor: "#4FD8EA", backgroundColor: "rgba(79,216,234,0.2)", fill: true, tension: 0.25, pointRadius: 0 }],
        },
        options: { ...CHART_BASE_OPTIONS, plugins: { legend: { display: false } } },
      },
      { col: 5, row: 1 },
      { width: 760, height: 380 }
    );
  }

  return workbook.xlsx.writeBuffer();
}

/**
 * Genera y descarga el Excel de asignaturas (función premium): resumen con
 * fórmulas + gráficas, registros diarios completos, clasificación histórica
 * y evolución acumulada. `data` es el objeto de datos completo de la app
 * ({ subjects, entries, cursos }) — se exporta siempre el histórico
 * completo, no solo el curso activo, igual que en Clasificación histórica.
 */
export async function exportSubjectsToExcel(data) {
  const buffer = await buildSubjectsWorkbookBuffer(data);
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(buffer, `bitacora-asignaturas-${stamp}.xlsx`);
}
