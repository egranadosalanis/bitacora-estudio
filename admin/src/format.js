export function formatMinutes(min) {
  const total = Math.round(min || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function formatCompact(n) {
  return new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatWeekLabel(weekStr) {
  const d = new Date(weekStr);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export const PLAN_LABELS = {
  free: "Free",
  premium_historico: "Premium · Histórico",
  premium_comparacion: "Premium · Comparación",
};
