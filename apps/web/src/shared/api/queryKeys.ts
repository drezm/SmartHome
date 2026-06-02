export const queryKeys = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  climate: (range: object, sensors: object = {}) => ["climate", range, sensors] as const,
  location: ["location"] as const,
  devices: ["devices"] as const,
  scenarios: ["scenarios"] as const,
  notifications: ["notifications"] as const,
  telemetry: ["telemetry"] as const,
  subscription: ["subscription"] as const,
  telegram: ["telegram"] as const,
  reports: ["reports"] as const,
  report: (kind: string, range: object, parameters: object) =>
    ["report", kind, range, parameters] as const,
  news: ["news"] as const
};
