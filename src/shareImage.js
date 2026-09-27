/* ------------------------------------------------------------------ */
/*  COMPARTIR UN TROZO DE LA APP COMO IMAGEN                            */
/*                                                                      */
/*  Convierte un nodo del DOM en un PNG y lo pasa a la hoja de          */
/*  compartir nativa del dispositivo (o lo descarga si el navegador no  */
/*  sabe compartir archivos). html2canvas-pro se carga de forma         */
/*  perezosa porque solo hace falta al pulsar "Compartir".              */
/* ------------------------------------------------------------------ */

async function nodeToPngBlob(node) {
  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(node, {
    // El propio nodo pinta su fondo (sólido o degradado) por completo:
    // dejar el lienzo base transparente evita rellenos de color de más.
    backgroundColor: null,
    scale: Math.min(2, window.devicePixelRatio || 1),
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen."))), "image/png");
  });
}

/** Comparte una captura de `node` como imagen PNG con la hoja de compartir
 * nativa (si el dispositivo sabe compartir archivos) o, si no, la descarga
 * para que el usuario la comparta a mano. */
export async function shareNodeAsImage(node, { fileName = "clever.png", title, text } = {}) {
  const blob = await nodeToPngBlob(node);
  const file = new File([blob], fileName, { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title, text });
    return "shared";
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return "downloaded";
}
