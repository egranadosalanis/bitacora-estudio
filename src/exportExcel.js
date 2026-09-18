/* ------------------------------------------------------------------ */
/*  EXPORTACIÓN A EXCEL (función premium)                              */
/*                                                                      */
/*  Genera un .xlsx del CURSO ACTIVO (no de todo el histórico) con el   */
/*  mismo formato que los Excel de horas de estudio hechos a mano: una  */
/*  matriz fecha × asignatura con lo estudiado cada día, un resumen por */
/*  asignatura con los cálculos (horas totales, horas/día, horas/       */
/*  crédito, desgaste...) y una hoja de gráficas. Las cifras del        */
/*  resumen son fórmulas reales sobre la matriz (con su valor ya        */
/*  calculado guardado como caché, para que se vean bien aunque el      */
/*  programa que abra el archivo no recalcule solo) — así, si se corrige */
/*  un dato en la matriz, el resumen se actualiza solo. ExcelJS y       */
/*  Chart.js se cargan de forma perezosa (import dinámico) porque solo  */
/*  hacen falta al pulsar "Exportar".                                   */
/* ------------------------------------------------------------------ */

import {
  parseISO, formatMedium, isoToday,
  computeStats, computeDesgaste, entriesInRange, subjectsWithActivityInRange,
} from "./domain.js";

const ESTADO_LABELS = { en_curso: "En curso", suspendida: "Suspendida", aprobada: "Aprobada" };

// Por si algún curso llega a acumular muchas asignaturas — sin este límite
// las barras se vuelven ilegibles y la leyenda de la rosca se sale del
// lienzo. La tabla de la hoja Resumen siempre lleva el detalle completo;
// la gráfica es solo un vistazo rápido.
const MAX_CHART_SLICES = 14;

/** Recorta `items` (ya ordenados de mayor a menor por `value`) a los
 * MAX_CHART_SLICES-1 primeros + una entrada "Otras" con el resto sumado
 * (solo si hace falta), para gráficas con leyenda. */
function topWithOthers(items, getValue, max = MAX_CHART_SLICES) {
  if (items.length <= max) return items.map((it) => ({ name: it.name, value: getValue(it), color: it.color }));
  const head = items.slice(0, max - 1).map((it) => ({ name: it.name, value: getValue(it), color: it.color }));
  const restValue = items.slice(max - 1).reduce((a, it) => a + getValue(it), 0);
  return [...head, { name: `Otras (${items.length - (max - 1)})`, value: restValue, color: "#94A3B8" }];
}

/** Convierte un índice de columna 1-indexado en su letra de Excel (1→A,
 * 2→B, ..., 27→AA...) — para construir rangos de fórmula sobre la matriz,
 * donde cada asignatura ocupa una columna fija. */
function colLetter(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
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
    r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND_FILL } };
  }
}

function borderRow(sheet, rowNumber, colCount) {
  const r = sheet.getRow(rowNumber);
  for (let c = 1; c <= colCount; c++) {
    r.getCell(c).border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  }
}

/** Convierte una fecha ISO "AAAA-MM-DD" en un Date "puro" (medianoche UTC)
 * — igual criterio de fechas que el resto de la app (ver domain.js). */
function excelDate(iso) {
  return parseISO(iso);
}

function addDaysLocal(iso, n) {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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
/*  HOJA 1 — REGISTRO DIARIO (matriz fecha × asignatura, en minutos)    */
/* ------------------------------------------------------------------ */

function buildMatrixSheet(workbook, { subjects, entries, curso }) {
  const today = isoToday();
  const endDate = curso.endDate && curso.endDate < today ? curso.endDate : today;
  const dates = [];
  if (curso.startDate && endDate >= curso.startDate) {
    for (let d = curso.startDate; d <= endDate; d = addDaysLocal(d, 1)) dates.push(d);
  }

  const sheet = workbook.addWorksheet("Registro diario", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  sheet.columns = [{ width: 13 }, ...subjects.map(() => ({ width: 15 }))];
  headerRow(sheet, 1, ["Fecha", ...subjects.map((s) => s.name)]);

  dates.forEach((date, i) => {
    const row = i + 2;
    const r = sheet.getRow(row);
    r.getCell(1).value = excelDate(date);
    r.getCell(1).numFmt = "dd/mm/yyyy";
    const dayEntries = entries[date] || {};
    subjects.forEach((s, j) => {
      const minutes = dayEntries[s.id];
      if (minutes > 0) r.getCell(j + 2).value = minutes;
    });
    bandRow(sheet, row, subjects.length + 1, i % 2 === 1);
    r.commit();
  });

  return { sheet, dates };
}

/* ------------------------------------------------------------------ */
/*  HOJA 2 — RESUMEN (una fila por asignatura, con los cálculos)       */
/* ------------------------------------------------------------------ */

function buildResumenSheet(workbook, { subjects, stats, globalEntries, numDates }) {
  const sheet = workbook.addWorksheet("Resumen", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { width: 32 }, { width: 14 }, { width: 10 }, { width: 14 },
    { width: 15 }, { width: 13 }, { width: 12 }, { width: 12 },
    { width: 14 }, { width: 14 }, { width: 16 },
  ];
  headerRow(sheet, 1, [
    "Asignatura", "Estado", "Créditos", "Horas totales",
    "Horas / día activo", "Horas / crédito", "% esfuerzo", "Días activos",
    "Último registro", "Desgaste (0-10)", "Nivel de desgaste",
  ]);

  const firstRow = 2;
  const lastMatrixRow = 1 + Math.max(numDates, 1);

  subjects.forEach((s, j) => {
    const row = firstRow + j;
    const r = sheet.getRow(row);
    const col = colLetter(j + 2);
    const rangeRow = `${col}${firstRow}:${col}${lastMatrixRow}`;
    const stat = stats.perSubject.find((p) => p.id === s.id);
    const d = computeDesgaste(s.id, globalEntries);

    r.getCell(1).value = s.name;
    r.getCell(2).value = ESTADO_LABELS[s.estado] || s.estado;
    r.getCell(3).value = s.credits;

    r.getCell(4).value = numDates > 0
      ? { formula: `SUM('Registro diario'!${rangeRow})/60`, result: +(stat.total / 60).toFixed(2) }
      : 0;
    r.getCell(4).numFmt = "0.00";

    const daysActiveFormula = numDates > 0 ? { formula: `COUNTIF('Registro diario'!${rangeRow},">0")`, result: stat.daysActive } : 0;

    r.getCell(5).value = numDates > 0
      ? { formula: `IF(COUNTIF('Registro diario'!${rangeRow},">0")=0,0,D${row}/COUNTIF('Registro diario'!${rangeRow},">0"))`, result: +(stat.avgActiveDay / 60).toFixed(2) }
      : 0;
    r.getCell(5).numFmt = "0.00";

    r.getCell(6).value = { formula: `IF(C${row}=0,0,D${row}/C${row})`, result: +stat.hoursPerCredit.toFixed(2) };
    r.getCell(6).numFmt = "0.00";

    r.getCell(7).value = { formula: `IF($D$${firstRow + subjects.length}=0,0,D${row}/$D$${firstRow + subjects.length})`, result: +(stat.pct / 100).toFixed(4) };
    r.getCell(7).numFmt = "0.0%";

    r.getCell(8).value = daysActiveFormula;

    r.getCell(9).value = numDates > 0 && stat.last
      ? { formula: `MAXIFS('Registro diario'!$A:$A,'Registro diario'!${rangeRow},">0")`, result: excelDate(stat.last) }
      : "—";
    if (numDates > 0 && stat.last) r.getCell(9).numFmt = "dd/mm/yyyy";

    r.getCell(10).value = d.comparable ? d.indice : "—";
    r.getCell(11).value = d.comparable ? d.etiqueta : "Sin datos suficientes";

    bandRow(sheet, row, 11, j % 2 === 1);
    borderRow(sheet, row, 11);
    r.commit();
  });

  const totalRow = firstRow + subjects.length;
  const tr = sheet.getRow(totalRow);
  tr.getCell(1).value = "Total";
  tr.getCell(1).font = { bold: true };
  tr.getCell(3).value = { formula: `SUM(C${firstRow}:C${totalRow - 1})`, result: subjects.reduce((a, s) => a + (s.credits || 0), 0) };
  tr.getCell(4).value = { formula: `SUM(D${firstRow}:D${totalRow - 1})`, result: +(stats.globalTotal / 60).toFixed(2) };
  tr.getCell(4).numFmt = "0.00";
  tr.getCell(7).value = { formula: `SUM(G${firstRow}:G${totalRow - 1})`, result: 1 };
  tr.getCell(7).numFmt = "0.0%";
  for (let c = 1; c <= 11; c++) {
    tr.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
    tr.getCell(c).border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  }
  tr.commit();

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: totalRow - 1, column: 11 } };

  return { sheet, totalRow };
}

/* ------------------------------------------------------------------ */
/*  HOJA 3 — GRÁFICOS                                                   */
/* ------------------------------------------------------------------ */

async function buildGraficosSheet(workbook, ChartJS, { stats, dates }) {
  const sheet = workbook.addWorksheet("Gráficos");
  sheet.columns = [{ width: 14 }];

  const withCredits = stats.perSubject.filter((s) => s.credits > 0);
  const withHours = stats.perSubject.filter((s) => s.total > 0);

  let nextRow = 1;

  if (withCredits.length > 0) {
    const bar = topWithOthers(withCredits, (s) => +s.hoursPerCredit.toFixed(2));
    sheet.getCell(`A${nextRow}`).value = "Esfuerzo por crédito (horas / crédito) por asignatura";
    sheet.getCell(`A${nextRow}`).font = { bold: true };
    await addChartImage(
      workbook, sheet, ChartJS,
      {
        type: "bar",
        data: { labels: bar.map((s) => s.name), datasets: [{ label: "Horas / crédito", data: bar.map((s) => s.value), backgroundColor: bar.map((s) => s.color) }] },
        options: { ...CHART_BASE_OPTIONS, plugins: { legend: { display: false } } },
      },
      { col: 0, row: nextRow },
    );
    nextRow += 21;
  }

  if (withHours.length > 0) {
    const donut = topWithOthers(withHours, (s) => +(s.total / 60).toFixed(2));
    sheet.getCell(`A${nextRow}`).value = "Distribución del esfuerzo (% del tiempo total)";
    sheet.getCell(`A${nextRow}`).font = { bold: true };
    await addChartImage(
      workbook, sheet, ChartJS,
      {
        type: "doughnut",
        data: { labels: donut.map((s) => s.name), datasets: [{ data: donut.map((s) => s.value), backgroundColor: donut.map((s) => s.color) }] },
        options: { plugins: { legend: { position: "right" } } },
      },
      { col: 0, row: nextRow },
      { width: 720, height: 420 },
    );
    nextRow += 23;
  }

  if (dates.length > 0) {
    let acc = 0;
    const cumulative = dates.map((date) => (acc += (stats.dailyTotals[date] || 0) / 60));
    sheet.getCell(`A${nextRow}`).value = "Horas acumuladas en el curso";
    sheet.getCell(`A${nextRow}`).font = { bold: true };
    await addChartImage(
      workbook, sheet, ChartJS,
      {
        type: "line",
        data: {
          labels: dates.map((d) => formatMedium(d)),
          datasets: [{ label: "Horas acumuladas", data: cumulative.map((v) => +v.toFixed(2)), borderColor: "#4FD8EA", backgroundColor: "rgba(79,216,234,0.2)", fill: true, tension: 0.25, pointRadius: 0 }],
        },
        options: { ...CHART_BASE_OPTIONS, plugins: { legend: { display: false } } },
      },
      { col: 0, row: nextRow },
      { width: 760, height: 380 },
    );
  }

  return { sheet };
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
 * Construye el libro de Excel del curso `curso` y devuelve su buffer, sin
 * descargarlo — separado de exportSubjectsToExcel para poder probar la
 * generación (fórmulas, hojas, gráficas) sin depender de un click real
 * del navegador. `data` es el objeto de datos completo de la app
 * ({ subjects, entries, cursos }); el export se limita a las asignaturas
 * y fechas de `curso`, igual que el resto de vistas del curso activo — el
 * desgaste es la única cifra que sigue mirando el histórico completo de
 * la asignatura, igual que en la pestaña Desgaste.
 */
export async function buildSubjectsWorkbookBuffer(data, curso) {
  const [{ default: ExcelJS }, { Chart: ChartJS, registerables }] = await Promise.all([
    import("exceljs"),
    import("chart.js"),
  ]);
  ChartJS.register(...registerables);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bitácora de estudio";
  workbook.created = new Date();
  // Las celdas de fórmula llevan también su valor ya calculado (`result`)
  // guardado como caché — así se ven bien nada más abrir el archivo aunque
  // el programa no las recalcule solo, y además fullCalcOnLoad fuerza esa
  // recalculación en Excel/Sheets/LibreOffice si el usuario toca algo.
  workbook.calcProperties.fullCalcOnLoad = true;

  const cursoSubjects = subjectsWithActivityInRange(data.subjects, data.entries, curso.startDate, curso.endDate);
  const cursoEntries = entriesInRange(data.entries, curso.startDate, curso.endDate);
  const stats = computeStats(cursoSubjects, cursoEntries);

  const { dates } = buildMatrixSheet(workbook, { subjects: cursoSubjects, entries: cursoEntries, curso });
  buildResumenSheet(workbook, { subjects: cursoSubjects, stats, globalEntries: data.entries, numDates: dates.length });
  await buildGraficosSheet(workbook, ChartJS, { stats, dates });

  return workbook.xlsx.writeBuffer();
}

/**
 * Genera y descarga el Excel del curso activo (función premium): matriz de
 * registro diario, resumen con fórmulas y gráficas. `curso` es el curso
 * seleccionado en la app en ese momento.
 */
export async function exportSubjectsToExcel(data, curso) {
  const buffer = await buildSubjectsWorkbookBuffer(data, curso);
  const stamp = new Date().toISOString().slice(0, 10);
  const safeCursoName = (curso.name || "curso").replace(/[^\p{L}\p{N}_-]+/gu, "_");
  triggerDownload(buffer, `bitacora-${safeCursoName}-${stamp}.xlsx`);
}
