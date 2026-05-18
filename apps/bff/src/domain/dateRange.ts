import type { DateRange, DateRangeInput } from "./types.js";

export function resolveDateRange(input: DateRangeInput): DateRange {
  if (input.from && input.to) {
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from.getTime() > to.getTime()) {
      throw new Error("Некорректный диапазон дат");
    }
    return { preset: "custom", from: from.toISOString(), to: to.toISOString() };
  }

  const now = new Date();
  const durationMs = input.preset === "24h" ? 24 * 60 * 60 * 1000 : input.preset === "7d" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return {
    preset: input.preset,
    from: new Date(now.getTime() - durationMs).toISOString(),
    to: now.toISOString()
  };
}

export function isInsideDateRange(value: string, range: Pick<DateRange, "from" | "to">) {
  const timestamp = new Date(value).getTime();
  return timestamp >= new Date(range.from).getTime() && timestamp <= new Date(range.to).getTime();
}

export function formatRangeLabel(range: DateRange) {
  if (range.preset === "24h") {
    return "24 часа";
  }
  if (range.preset === "7d") {
    return "7 дней";
  }
  if (range.preset === "30d") {
    return "30 дней";
  }
  return `${formatDate(range.from)} — ${formatDate(range.to)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}
