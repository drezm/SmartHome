import type { DashboardSummary } from "@/shared/api/types";

type BackendStatus = DashboardSummary["backendStatus"];

export function getBackendStatusView(status?: BackendStatus) {
  if (!status || status.mode === "local") {
    return {
      label: "Локально",
      detail: "Collector не требуется",
      badgeClassName: "border-violet-400/20 bg-violet-500/15 text-violet-200",
      textClassName: "text-violet-200",
      ok: true
    };
  }

  if (status.mode === "degraded") {
    return {
      label: "Нет связи",
      detail: status.lastSyncError ?? "Collector недоступен",
      badgeClassName: "border-red-400/20 bg-red-500/15 text-red-300",
      textClassName: "text-red-300",
      ok: false
    };
  }

  return {
    label: "Online",
    detail: status.collectorUrl,
    badgeClassName: "border-emerald-400/20 bg-emerald-500/15 text-emerald-300",
    textClassName: "text-emerald-300",
    ok: true
  };
}
