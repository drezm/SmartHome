import { collectorClient, type CollectorClient } from "../adapters/grpc/collectorClient.js";
import type {
  DashboardSummary,
  Device,
  DeviceCategory,
  DeviceType,
  QuickActionKind,
  ScenarioCommand,
  ScenarioMetric,
  ScenarioOperator
} from "../domain/types.js";
import type { HomeStore } from "../repositories/contracts.js";

export class HomeService {
  constructor(private readonly home: HomeStore, private readonly collector: CollectorClient = collectorClient) {}

  async listDevices(userId: string) {
    return this.home.listDevices(userId);
  }

  async createDevice(
    userId: string,
    input: {
      name: string;
      type: DeviceType;
      category: DeviceCategory;
      room: string;
      enabled?: boolean;
    }
  ) {
    const device = await this.home.createDevice(userId, input);
    await this.trySync(userId, () => this.collector.sendDeviceAdded(device), "Устройство добавлено локально, но collector недоступен");
    return device;
  }

  async updateDevice(userId: string, id: string, input: Partial<Pick<Device, "name" | "category" | "room" | "online" | "enabled" | "metric">>) {
    const device = await this.home.updateDevice(userId, id, input);
    if (!device) {
      return null;
    }

    if (input.enabled !== undefined) {
      await this.trySync(userId, () => this.collector.sendSwitchState(device), "Состояние устройства сохранено локально, но collector недоступен");
    }

    return device;
  }

  async deleteDevice(userId: string, id: string) {
    const device = await this.home.deleteDevice(userId, id);
    if (!device) {
      return null;
    }

    await this.trySync(userId, () => this.collector.sendDeviceRemoved(device), "Устройство удалено локально, но collector недоступен");
    return device;
  }

  async listScenarios(userId: string) {
    return this.home.listScenarios(userId);
  }

  async createScenario(
    userId: string,
    input: {
      title: string;
      metric: ScenarioMetric;
      operator: ScenarioOperator;
      value: number;
      unit: string | null;
      targetDeviceId: string | null;
      targetDeviceName: string;
      command: ScenarioCommand;
      active?: boolean;
    }
  ) {
    const scenario = await this.home.createScenario(userId, input);
    await this.trySync(userId, () => this.collector.sendScenarioAdded(scenario), "Сценарий сохранен локально, но collector недоступен");
    return scenario;
  }

  async updateScenario(userId: string, id: string, input: { title?: string; active?: boolean }) {
    return this.home.updateScenario(userId, id, input);
  }

  async deleteScenario(userId: string, id: string) {
    const scenario = await this.home.deleteScenario(userId, id);
    if (!scenario) {
      return null;
    }

    await this.trySync(userId, () => this.collector.sendScenarioRemoved(scenario), "Сценарий удален локально, но collector недоступен");
    return scenario;
  }

  async listNotifications(userId: string) {
    return this.home.listNotifications(userId);
  }

  async markNotificationRead(userId: string, id: string) {
    return this.home.markNotificationRead(userId, id);
  }

  async listTelemetry(userId: string) {
    return this.home.listTelemetry(userId);
  }

  async addTelemetry(userId: string, deviceId: string, input: { kind: string; value: number; unit: string | null }) {
    const device = await this.home.getDevice(userId, deviceId);
    if (!device) {
      return null;
    }

    const point = await this.home.createTelemetry(userId, {
      deviceId,
      kind: input.kind,
      value: input.value,
      unit: input.unit
    });

    await this.trySync(userId, () => this.collector.sendTelemetry(device, input), "Телеметрия сохранена локально, но collector недоступен");
    return point;
  }

  async applyQuickAction(userId: string, action: QuickActionKind) {
    const devices = await this.home.applyQuickAction(userId, action);
    const changed = devices.filter((device) => {
      if (action === "TURN_OFF_ALL" || action === "NIGHT_MODE") return true;
      if (action === "TURN_ON_LIGHTS") return device.category === "Освещение";
      if (action === "MORNING_MODE") return device.category === "Освещение" || device.category === "Климат";
      return false;
    });

    await Promise.all(changed.map((device) => this.trySync(userId, () => this.collector.sendSwitchState(device), "Быстрое действие применено локально, но collector недоступен")));
    await this.home.createNotification(userId, quickActionTitle(action), "system", true);
    return devices;
  }

  async getDashboard(userId: string): Promise<DashboardSummary> {
    const devices = await this.home.listDevices(userId);
    const scenarios = await this.home.listScenarios(userId);
    const notifications = await this.home.listNotifications(userId);
    const telemetry = await this.home.listTelemetry(userId);
    const temperature = telemetry.filter((item) => item.kind === "temperature").at(-1)?.value ?? null;
    const today = new Date().toISOString().slice(0, 10);

    return {
      stats: {
        temperature,
        onlineDevices: devices.filter((device) => device.online).length,
        totalDevices: devices.length,
        activeScenarios: scenarios.filter((scenario) => scenario.active).length,
        eventsToday: notifications.filter((item) => item.createdAt.startsWith(today)).length,
        unreadNotifications: notifications.filter((item) => item.unread).length
      },
      temperatureSeries: buildTemperatureSeries(telemetry),
      activitySeries: buildActivitySeries(notifications),
      currentScenario: scenarios.find((scenario) => scenario.active) ?? null,
      backendStatus: this.collector.getStatus()
    };
  }

  private async trySync(userId: string, fn: () => Promise<void>, fallbackNotification: string) {
    try {
      await fn();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown sync error";
      await this.home.createNotification(userId, `${fallbackNotification}: ${detail}`, "system", true);
    }
  }
}

function buildTemperatureSeries(telemetry: Awaited<ReturnType<HomeStore["listTelemetry"]>>) {
  const temperature = telemetry.filter((item) => item.kind === "temperature").slice(-12);
  if (temperature.length === 0) {
    return [];
  }

  return temperature.map((item) => ({
    time: new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt)),
    value: item.value
  }));
}

function buildActivitySeries(notifications: Awaited<ReturnType<HomeStore["listNotifications"]>>) {
  const formatter = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      key: date.toISOString().slice(0, 10),
      day: formatter.format(date).replace(".", ""),
      events: 0
    };
  });

  for (const notification of notifications) {
    const key = notification.createdAt.slice(0, 10);
    const item = days.find((day) => day.key === key);
    if (item) {
      item.events += 1;
    }
  }

  return days.map(({ day, events }) => ({ day, events }));
}

function quickActionTitle(action: QuickActionKind) {
  const dictionary: Record<QuickActionKind, string> = {
    TURN_ON_LIGHTS: "Включен свет в доме",
    TURN_OFF_ALL: "Все устройства выключены",
    NIGHT_MODE: "Активирован ночной режим",
    MORNING_MODE: "Активирован утренний режим"
  };

  return dictionary[action];
}
