import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("UI cleanup plan", () => {
  it("removes demo stats from auth page", () => {
    const source = read("pages/auth/AuthPage.tsx");

    expect(source).not.toContain('title="Устройств"');
    expect(source).not.toContain('title="Сценариев"');
    expect(source).not.toContain('title="Событий"');
  });

  it("replaces dashboard runtime diagnostics with weather by location", () => {
    const source = read("pages/dashboard/DashboardPage.tsx");

    expect(source).toContain("Погода по локации");
    expect(source).toContain("Климат дома");
    expect(source).toContain("api.climate");
    expect(source).toContain("humiditySeries");
    expect(source).not.toContain("Collector URL");
    expect(source).not.toContain("Scheduler");
    expect(source).not.toContain("Hub Router");
  });

  it("keeps Telegram integrations without legacy placeholders", () => {
    const source = read("pages/profile/ProfilePage.tsx");

    expect(source).toContain("Telegram-интеграция");
    expect(source).not.toContain("Yandex Smart Home");
    expect(source).not.toContain("Telemetry Collector");
  });

  it("shows home location settings without runtime collector status", () => {
    const source = read("pages/settings/SettingsPage.tsx");

    expect(source).toContain("Локация дома");
    expect(source).not.toContain("Collector");
  });

  it("separates outdoor sensors, home sensors and devices", () => {
    const devicesPage = read("pages/devices/DevicesPage.tsx");
    const deviceCard = read("entities/device/DeviceCard.tsx");
    const deviceModal = read("features/devices/CreateDeviceModal.tsx");

    expect(devicesPage).toContain("Уличные датчики");
    expect(devicesPage).toContain("Домашние датчики");
    expect(devicesPage).toContain("Устройства дома");
    expect(deviceCard).toContain("Редактировать");
    expect(deviceCard).toContain("Удалить");
    expect(deviceCard).not.toContain("Подробнее");
    expect(deviceModal).toContain("Устройство");
    expect(deviceModal).toContain("Домашний датчик");
    expect(deviceModal).toContain("Уличный датчик");
    expect(deviceModal).not.toContain("реальный");
    expect(deviceModal).not.toContain("виртуальный");
    expect(deviceModal).not.toContain("демо");
  });

  it("keeps weather device out of scenario targets and darkens modal selects", () => {
    const scenarioModal = read("features/scenarios/CreateScenarioModal.tsx");
    const modal = read("shared/ui/Modal.tsx");
    const select = read("shared/ui/Select.tsx");

    expect(scenarioModal).toContain("Источник");
    expect(scenarioModal).toContain("Время");
    expect(scenarioModal).toContain('type="time"');
    expect(scenarioModal).toContain("Ручной режим");
    expect(scenarioModal).toContain("isScenarioSourceDevice");
    expect(scenarioModal).toContain("getMetricsForDevice");
    expect(modal).toContain("colorScheme");
    expect(select).toContain("bg-[#09090B]");
  });

  it("removes legacy shell noise and quick actions API", () => {
    const appShell = read("widgets/app-shell/AppShell.tsx");
    const quickActions = read("features/quick-actions/QuickActions.tsx");
    const newsBanner = read("features/news/NewsBanner.tsx");

    expect(appShell).not.toContain('label: "Профиль"');
    expect(appShell).not.toContain("Статус сети");
    expect(appShell).toContain("TelegramAdBanner");
    expect(appShell).toContain('navigate("/profile")');
    expect(quickActions).toContain("runScenario");
    expect(quickActions).not.toContain("TURN_ON_LIGHTS");
    expect(newsBanner).toContain("Новости умного дома");
  });

  it("shows report library and hides telemetry values on ordinary devices", () => {
    const analyticsPage = read("pages/analytics/AnalyticsPage.tsx");
    const deviceCard = read("entities/device/DeviceCard.tsx");

    expect(analyticsPage).toContain("Библиотека отчетов");
    expect(analyticsPage).toContain("5 отчетов доступны всем");
    expect(analyticsPage).toContain("ReportParameterControls");
    expect(analyticsPage).toContain("downloadError");
    expect(analyticsPage).toContain("ReportBlockView");
    expect(analyticsPage).toContain('type="date"');
    expect(read("pages/analytics/AnalyticsCharts.tsx")).toContain("connectNulls");
    expect(deviceCard).toContain('device.sourceKind !== "manual"');
  });
});
