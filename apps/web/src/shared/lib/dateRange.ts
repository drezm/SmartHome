import type { DateRange, DateRangeInput } from "@/shared/api/types";

export function buildCustomDateRange(preset: DateRangeInput["preset"], from: string, to: string): DateRangeInput {
  return {
    preset,
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59.999`).toISOString()
  };
}

export function isCustomDateRange(range: DateRangeInput) {
  return Boolean(range.from && range.to);
}

export function formatDateRangeLabel(range: DateRange) {
  if (range.preset === "24h") {
    return "24 часа";
  }
  if (range.preset === "7d") {
    return "7 дней";
  }
  if (range.preset === "30d") {
    return "30 дней";
  }
  const formatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  return `${formatter.format(new Date(range.from))} — ${formatter.format(new Date(range.to))}`;
}
