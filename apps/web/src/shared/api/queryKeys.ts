export const queryKeys = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  devices: ["devices"] as const,
  scenarios: ["scenarios"] as const,
  notifications: ["notifications"] as const,
  telemetry: ["telemetry"] as const,
  subscription: ["subscription"] as const,
  telegram: ["telegram"] as const,
  report: (range: "7d" | "30d") => ["report", range] as const,
  news: ["news"] as const
};
