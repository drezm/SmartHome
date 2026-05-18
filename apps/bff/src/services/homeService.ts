import type {
  ClimateSeriesPayload,
  DateRange,
  DateRangeInput,
  DashboardSummary,
  Device,
  DeviceCategory,
  DeviceSourceKind,
  DeviceSourceMetric,
  DeviceType,
  HomeSensorMetric,
  NewsItem,
  OpenMeteoMetric,
  ReportBlock,
  ReportCatalogItem,
  ReportKind,
  ReportParameterDefinition,
  ReportParameters,
  ReportPayload,
  Scenario,
  ScenarioAction,
  ScenarioAutomationSource,
  ScenarioEvaluation,
  ScenarioCommand,
  ScenarioLastEvaluation,
  ScenarioMetric,
  ScenarioOperator,
  ScenarioTriggerType,
  Subscription,
  TelegramIntegration
} from "../domain/types.js";
import type { HomeStore, UserStore } from "../repositories/contracts.js";
import { decryptSecret, encryptSecret } from "./secretService.js";
import { NewsService } from "./newsService.js";
import {
  buildOpenMeteoDeviceId,
  getOpenMeteoDefinition,
  isOpenMeteoMetric,
  isLegacyWeatherDeviceId,
  isSystemDeviceId,
  WeatherService
} from "./weatherService.js";
import { getHomeSensorDefinition, HomeSensorService, isHomeSensorMetric } from "./homeSensorService.js";
import {
  automaticScenarioAppliedMessage,
  deviceStateChangedMessage,
  manualScenarioRunMessage,
  reportGeneratedMessage,
  scenarioCreatedMessage,
  scenarioUpdatedMessage,
  subscriptionActivatedMessage,
  subscriptionCancelledMessage,
  telegramConnectedTestMessage,
  telemetryChangedMessage
} from "./telegramMessages.js";
import { formatRangeLabel, isInsideDateRange, resolveDateRange } from "../domain/dateRange.js";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const DEVICE_PARAMETER: ReportParameterDefinition = { key: "deviceId", label: "Устройство", kind: "device", required: true };
const SENSOR_PARAMETER: ReportParameterDefinition = { key: "sensorId", label: "Датчик", kind: "sensor", required: true };
const ROOM_A_PARAMETER: ReportParameterDefinition = { key: "roomA", label: "Комната A", kind: "room", required: true };
const ROOM_B_PARAMETER: ReportParameterDefinition = { key: "roomB", label: "Комната B", kind: "room", required: true };

const REPORT_DEFINITIONS: Array<Omit<ReportCatalogItem, "available">> = [
  {
    kind: "home_summary",
    title: "Сводка дома",
    description: "Главные показатели дома за выбранный период.",
    premiumOnly: false,
    parameters: []
  },
  {
    kind: "device_activity",
    title: "Активность устройств",
    description: "Какие устройства работали чаще всего.",
    premiumOnly: false,
    parameters: []
  },
  {
    kind: "home_climate",
    title: "Климат дома",
    description: "Температура и влажность по домашним датчикам.",
    premiumOnly: false,
    parameters: []
  },
  {
    kind: "scenario_activity",
    title: "Сценарии",
    description: "Активные правила и ручные режимы.",
    premiumOnly: false,
    parameters: []
  },
  {
    kind: "notifications",
    title: "Уведомления",
    description: "События и типы уведомлений за период.",
    premiumOnly: false,
    parameters: []
  },
  {
    kind: "device_detail",
    title: "Отчет по устройству",
    description: "Детали работы отдельных устройств.",
    premiumOnly: true,
    parameters: [DEVICE_PARAMETER]
  },
  {
    kind: "sensor_detail",
    title: "Отчет по датчику",
    description: "Подробная динамика показаний датчиков.",
    premiumOnly: true,
    parameters: [SENSOR_PARAMETER]
  },
  {
    kind: "room_comparison",
    title: "Сравнение комнат",
    description: "Разница в активности и климате между комнатами.",
    premiumOnly: true,
    parameters: [ROOM_A_PARAMETER, ROOM_B_PARAMETER]
  },
  {
    kind: "indoor_outdoor",
    title: "Дом и улица",
    description: "Сопоставление домашних и уличных показаний.",
    premiumOnly: true,
    parameters: []
  },
  {
    kind: "peak_activity",
    title: "Пиковые часы активности",
    description: "Когда дом чаще всего меняет состояние.",
    premiumOnly: true,
    parameters: []
  }
];

export class HomeService {
  constructor(
    private readonly home: HomeStore,
    private readonly users: UserStore,
    private readonly news = new NewsService(),
    private readonly weather = new WeatherService(home),
    private readonly homeSensors = new HomeSensorService(home)
  ) {}

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
      sourceKind?: DeviceSourceKind;
      sourceMetric?: DeviceSourceMetric | null;
    }
  ) {
    if (input.sourceKind === "open_meteo") {
      if (!isOpenMeteoMetric(input.sourceMetric)) {
        throw new Error("Для Open-Meteo-датчика нужно выбрать метрику");
      }
      return this.weather.ensureOpenMeteoSensor(userId, input.sourceMetric);
    }

    if (input.sourceKind === "home_sensor") {
      if (!isHomeSensorMetric(input.sourceMetric)) {
        throw new Error("Для домашнего датчика нужно выбрать метрику");
      }
      const definition = getHomeSensorDefinition(input.sourceMetric);
      const device = await this.home.createDevice(userId, {
        ...input,
        type: definition.type,
        category: definition.category,
        sourceKind: "home_sensor",
        sourceMetric: input.sourceMetric,
        isSystem: false
      });
      await this.homeSensors.refreshUserSensors(userId, [device]);
      return (await this.home.getDevice(userId, device.id)) ?? device;
    }

    return this.home.createDevice(userId, {
      ...input,
      sourceKind: "manual",
      sourceMetric: null,
      isSystem: false
    });
  }

  async updateDevice(userId: string, id: string, input: Partial<Pick<Device, "name" | "type" | "category" | "room" | "online" | "enabled" | "metric">>) {
    this.assertUserEditableDevice(id, "Системное погодное устройство нельзя редактировать");
    const previous = await this.home.getDevice(userId, id);
    const device = await this.home.updateDevice(userId, id, input);
    if (!device) {
      return null;
    }
    if (previous && input.enabled !== undefined && previous.enabled !== device.enabled && device.sourceKind === "manual") {
      await this.trySendTelegram(userId, deviceStateChangedMessage(device));
    }

    return device;
  }

  async deleteDevice(userId: string, id: string) {
    this.assertUserEditableDevice(id, "Системное погодное устройство нельзя удалить");
    const device = await this.home.deleteDevice(userId, id);
    if (!device) {
      return null;
    }

    return device;
  }

  async listScenarios(userId: string) {
    await this.ensureManualTemplates(userId);
    return this.home.listScenarios(userId);
  }

  async createScenario(
    userId: string,
    input: {
      title: string;
      triggerType?: ScenarioTriggerType;
      automationSource?: ScenarioAutomationSource;
      favorite?: boolean;
      metric: ScenarioMetric;
      operator: ScenarioOperator;
      value: number;
      unit: string | null;
      sourceDeviceId?: string | null;
      sourceDeviceName?: string | null;
      sourceMetric?: string | null;
      scheduleTime?: string | null;
      scheduleTimezone?: string | null;
      lastScheduleRunAt?: string | null;
      targetDeviceId: string | null;
      targetDeviceName: string;
      command: ScenarioCommand;
      active?: boolean;
      actions?: Array<Omit<ScenarioAction, "id">>;
    }
  ) {
    if (input.targetDeviceId && isSystemDeviceId(input.targetDeviceId)) {
      throw new Error("Системное устройство нельзя выбрать целью сценария");
    }

    const normalized = await this.normalizeScenarioInput(userId, input);
    const scenario = await this.home.createScenario(userId, normalized);
    await this.trySendTelegram(userId, scenarioCreatedMessage(scenario));
    return scenario;
  }

  async updateScenario(
    userId: string,
    id: string,
    input: Partial<
      Pick<
        Scenario,
        | "title"
        | "triggerType"
        | "automationSource"
        | "favorite"
        | "metric"
        | "operator"
        | "value"
        | "unit"
        | "sourceDeviceId"
        | "sourceDeviceName"
        | "sourceMetric"
        | "scheduleTime"
        | "scheduleTimezone"
        | "lastScheduleRunAt"
        | "targetDeviceId"
        | "targetDeviceName"
        | "command"
        | "active"
      >
    > & { actions?: Array<Omit<ScenarioAction, "id">> }
  ) {
    if (input.targetDeviceId && isSystemDeviceId(input.targetDeviceId)) {
      throw new Error("Системное устройство нельзя выбрать целью сценария");
    }

    const current = await this.home.getScenario(userId, id);
    if (!current) {
      return null;
    }

    const normalized = await this.normalizeScenarioInput(userId, {
      ...current,
      ...input,
      actions: input.actions ?? current.actions
    });
    const scenario = await this.home.updateScenario(userId, id, normalized);
    if (scenario) {
      await this.trySendTelegram(userId, scenarioUpdatedMessage(scenario));
    }
    return scenario;
  }

  async deleteScenario(userId: string, id: string) {
    const scenario = await this.home.deleteScenario(userId, id);
    if (!scenario) {
      return null;
    }

    return scenario;
  }

  async listNotifications(userId: string) {
    return this.home.listNotifications(userId);
  }

  async markNotificationRead(userId: string, id: string) {
    return this.home.markNotificationRead(userId, id);
  }

  async listTelemetry(userId: string) {
    return this.home.listLatestTelemetry(userId);
  }

  async getHomeLocation(userId: string) {
    return this.home.getHomeLocation(userId);
  }

  async updateHomeLocation(
    userId: string,
    input: {
      latitude: number;
      longitude: number;
      accuracyMeters: number | null;
      timezone: string;
      label: string | null;
      source: "browser" | "manual" | "geocoding";
    }
  ) {
    const hubId = await this.getHubId(userId);
    return this.home.upsertHomeLocation(userId, { ...input, hubId });
  }

  async addTelemetry(userId: string, deviceId: string, input: { kind: string; value: number; unit: string | null }) {
    this.assertUserEditableDevice(deviceId, "Системному устройству нельзя вручную добавлять телеметрию");
    return this.saveTelemetry(userId, deviceId, input, { sendTelegram: true });
  }

  async runManualScenario(userId: string, id: string) {
    const scenario = await this.home.getScenario(userId, id);
    if (!scenario || scenario.triggerType !== "manual") {
      return null;
    }
    if (!scenario.active) {
      throw new Error("Ручной сценарий выключен");
    }

    const devices = await this.home.listDevices(userId);
    let changed = 0;

    for (const action of scenario.actions) {
      if (!action.targetDeviceId || isSystemDeviceId(action.targetDeviceId)) {
        continue;
      }
      const target = devices.find((device) => device.id === action.targetDeviceId);
      if (!target || target.sourceKind !== "manual") {
        continue;
      }
      const desiredEnabled = getDesiredEnabledFromCommand(action.command, target?.enabled ?? null);
      if (desiredEnabled === null || target.enabled === desiredEnabled) {
        continue;
      }

      await this.home.updateDevice(userId, target.id, { enabled: desiredEnabled, online: true });
      changed += 1;
    }

    await this.home.createNotification(userId, `Запущен ручной сценарий "${scenario.title}"`, "scenario", true);
    await this.trySendTelegram(userId, manualScenarioRunMessage(scenario, changed));
    return { scenario, changed };
  }

  async runAutomationCycle() {
    const users = await this.users.listAll();
    for (const user of users) {
      await this.runAutomationForUser(user.id);
    }
  }

  async runAutomationForUser(userId: string) {
    await this.ensureManualTemplates(userId);
    const weather = await this.weather.getCurrentWeather(userId);
    let devices = await this.home.listDevices(userId);
    await this.homeSensors.refreshUserSensors(userId, devices);
    devices = await this.home.listDevices(userId);
    await this.ensureLegacyScenarioSources(userId, devices);
    const scenarios = (await this.home.listScenarios(userId)).filter((scenario) => scenario.triggerType === "automatic" && scenario.active);
    const telemetry = await this.home.listLatestTelemetry(userId);

    for (const scenario of scenarios) {
      const result =
        scenario.automationSource === "schedule"
          ? await this.evaluateScheduleScenario(userId, scenario, devices)
          : await this.evaluateScenario(userId, scenario, devices, telemetry);
      devices = result.devices;
    }

    return { weather, devices };
  }

  private async normalizeScenarioInput(
    userId: string,
    input: {
      title: string;
      triggerType?: ScenarioTriggerType;
      automationSource?: ScenarioAutomationSource;
      favorite?: boolean;
      metric: ScenarioMetric;
      operator: ScenarioOperator;
      value: number;
      unit: string | null;
      sourceDeviceId?: string | null;
      sourceDeviceName?: string | null;
      sourceMetric?: string | null;
      scheduleTime?: string | null;
      scheduleTimezone?: string | null;
      lastScheduleRunAt?: string | null;
      targetDeviceId: string | null;
      targetDeviceName: string;
      command: ScenarioCommand;
      active?: boolean;
      actions?: Array<Omit<ScenarioAction, "id">>;
    }
  ) {
    const triggerType = input.triggerType ?? "automatic";
    const automationSource = input.automationSource ?? "sensor";

    if (triggerType === "manual") {
      const normalizedActions = normalizeActions(input.actions ?? []);
      const targetIds = new Set((await this.home.listDevices(userId)).filter((device) => device.sourceKind === "manual").map((device) => device.id));
      if (normalizedActions.some((action) => !action.targetDeviceId || !targetIds.has(action.targetDeviceId))) {
        throw new Error("Ручной режим может управлять только устройствами");
      }
      return {
        ...input,
        triggerType,
        automationSource: "sensor" as const,
        sourceDeviceId: null,
        sourceDeviceName: null,
        sourceMetric: null,
        scheduleTime: null,
        scheduleTimezone: null,
        lastScheduleRunAt: null,
        actions: normalizedActions,
        favorite: input.favorite ?? false
      };
    }

    if (automationSource === "schedule") {
      if (!input.scheduleTime || !isValidScheduleTime(input.scheduleTime)) {
        throw new Error("Для сценария по времени нужно выбрать время");
      }
      if (input.targetDeviceId) {
        const targetDevice = await this.home.getDevice(userId, input.targetDeviceId);
        if (!targetDevice || targetDevice.sourceKind !== "manual") {
          throw new Error("Целью сценария должно быть устройство");
        }
      }
      const location = await this.home.getHomeLocation(userId);
      return {
        ...input,
        triggerType,
        automationSource,
        favorite: false,
        metric: "Выключатель" as const,
        operator: "=" as const,
        value: 1,
        unit: null,
        sourceDeviceId: null,
        sourceDeviceName: null,
        sourceMetric: null,
        scheduleTimezone: input.scheduleTimezone ?? location?.timezone ?? "Europe/Moscow",
        actions: []
      };
    }

    const sourceDevice = input.sourceDeviceId ? await this.home.getDevice(userId, input.sourceDeviceId) : null;
    if (input.sourceDeviceId && !sourceDevice) {
      throw new Error("Источник сценария не найден");
    }
    if (!input.sourceDeviceId || !input.sourceMetric) {
      throw new Error("Для автоматического сценария нужно выбрать источник и метрику");
    }
    if (!sourceDevice || sourceDevice.sourceKind === "manual") {
      throw new Error("Для автоматического сценария нужен датчик");
    }
    if (!getSupportedScenarioMetrics(sourceDevice).includes(input.sourceMetric)) {
      throw new Error("Выбранная метрика не поддерживается этим датчиком");
    }
    if (input.targetDeviceId) {
      const targetDevice = await this.home.getDevice(userId, input.targetDeviceId);
      if (!targetDevice || targetDevice.sourceKind !== "manual") {
        throw new Error("Целью сценария должно быть устройство");
      }
    }

    return {
      ...input,
      triggerType,
      automationSource,
      favorite: false,
      sourceDeviceName: sourceDevice?.name ?? input.sourceDeviceName ?? null,
      scheduleTime: null,
      scheduleTimezone: null,
      lastScheduleRunAt: null,
      actions: []
    };
  }

  private async ensureManualTemplates(userId: string) {
    const scenarios = await this.home.listScenarios(userId);
    if (scenarios.some((scenario) => scenario.triggerType === "manual" && scenario.favorite)) {
      return;
    }

    const devices = (await this.home.listDevices(userId)).filter((device) => !device.isSystem && !isLegacyWeatherDeviceId(device.id));
    const templates = buildManualTemplates(devices);

    for (const template of templates) {
      await this.home.createScenario(userId, template);
    }
  }

  private async ensureLegacyScenarioSources(userId: string, devices: Device[]) {
    const scenarios = await this.home.listScenarios(userId);
    const bindings = [
      { metric: "Температура" as const, sourceMetric: "temperature", weatherMetric: "temperature_2m" as const },
      { metric: "Влажность" as const, sourceMetric: "humidity", weatherMetric: "relative_humidity_2m" as const }
    ];

    for (const scenario of scenarios.filter((item) => item.triggerType === "automatic" && item.automationSource === "sensor" && !item.sourceDeviceId)) {
      const binding = bindings.find((item) => item.metric === scenario.metric);
      if (!binding) {
        continue;
      }
      const sourceDeviceId = buildOpenMeteoDeviceId(binding.weatherMetric, userId);
      const sourceDevice =
        devices.find((device) => device.id === sourceDeviceId) ?? (await this.weather.ensureOpenMeteoSensor(userId, binding.weatherMetric));
      await this.home.updateScenario(userId, scenario.id, {
        sourceDeviceId: sourceDevice.id,
        sourceDeviceName: sourceDevice.name,
        sourceMetric: binding.sourceMetric
      });
    }
  }

  private async saveTelemetry(
    userId: string,
    deviceId: string,
    input: { kind: string; value: number; unit: string | null },
    options: { sendTelegram: boolean }
  ) {
    const device = await this.home.getDevice(userId, deviceId);
    if (!device) {
      return null;
    }

    const previousMetric = device.metric;
    const point = await this.home.createTelemetry(userId, {
      deviceId,
      kind: input.kind,
      value: input.value,
      unit: input.unit
    });

    const nextMetric = `${input.value}${input.unit ?? ""}`;
    if (options.sendTelegram) {
      await this.trySendTelegram(userId, telemetryChangedMessage(device, previousMetric, nextMetric));
    }

    return point;
  }

  private async getHubId(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new Error("Пользователь не найден");
    }

    return user.hubId;
  }

  async getSubscription(userId: string): Promise<Subscription> {
    return this.home.getSubscription(userId);
  }

  async checkoutSubscription(
    userId: string,
    input: {
      cardholderName: string;
      cardNumber: string;
      expires: string;
      cvc: string;
      paymentEmail: string;
    }
  ) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const last4 = input.cardNumber.replace(/\D/g, "").slice(-4);
    const subscription = await this.home.upsertSubscription(userId, {
      plan: "premium",
      status: "active",
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      cancelledAt: null,
      paymentMockLast4: last4 || null,
      paymentEmail: input.paymentEmail
    });

    await this.home.createNotification(userId, `Подписка SmartHome Premium активирована до ${formatDate(expiresAt.toISOString())}`, "system", true);
    await this.trySendTelegram(userId, subscriptionActivatedMessage(subscription));
    return subscription;
  }

  async cancelSubscription(userId: string) {
    const current = await this.home.getSubscription(userId);
    if (!current.isPremium || !current.expiresAt) {
      throw new Error("Нет активной подписки для отключения продления");
    }
    if (current.status === "cancelled") {
      return current;
    }

    const subscription = await this.home.upsertSubscription(userId, {
      plan: "premium",
      status: "cancelled",
      startedAt: current.startedAt,
      expiresAt: current.expiresAt,
      cancelledAt: new Date().toISOString(),
      paymentMockLast4: current.paymentMockLast4,
      paymentEmail: current.paymentEmail
    });

    await this.home.createNotification(userId, `Продление SmartHome Premium отключено. Доступ открыт до ${formatDate(current.expiresAt)}`, "system", true);
    await this.trySendTelegram(userId, subscriptionCancelledMessage(subscription));
    return subscription;
  }

  async getTelegramIntegration(userId: string): Promise<TelegramIntegration> {
    await this.requirePremium(userId);
    return this.home.getTelegramIntegration(userId);
  }

  async updateTelegramIntegration(userId: string, input: { botToken: string; chatId: string }) {
    await this.requirePremium(userId);
    return this.home.upsertTelegramIntegration(userId, {
      botTokenEncrypted: encryptSecret(input.botToken),
      chatId: input.chatId
    });
  }

  async deleteTelegramIntegration(userId: string) {
    await this.requirePremium(userId);
    await this.home.deleteTelegramIntegration(userId);
    return this.home.getTelegramIntegration(userId);
  }

  async sendTelegramTest(userId: string) {
    await this.requirePremium(userId);
    await this.sendTelegram(userId, telegramConnectedTestMessage());
    return { sent: true };
  }

  async getReportCatalog(userId: string): Promise<ReportCatalogItem[]> {
    const subscription = await this.home.getSubscription(userId);
    return REPORT_DEFINITIONS.map((report) => ({
      ...report,
      available: !report.premiumOnly || subscription.isPremium
    }));
  }

  async getReport(userId: string, kind: ReportKind, rangeInput: DateRangeInput, parameters: ReportParameters = {}): Promise<ReportPayload> {
    const definition = getReportDefinition(kind);
    if (definition.premiumOnly) {
      await this.requirePremium(userId);
    }
    const range = resolveDateRange(rangeInput);
    const context = await this.buildReportContext(userId, range);
    return buildReportPayload(kind, definition, context, parameters);
  }

  async getReportPdf(userId: string, kind: ReportKind, rangeInput: DateRangeInput, parameters: ReportParameters = {}): Promise<Buffer> {
    await this.requirePremium(userId);
    const report = await this.getReport(userId, kind, rangeInput, parameters);
    await this.trySendTelegram(userId, reportGeneratedMessage(report));
    return renderReportPdf(report);
  }

  private async buildReportContext(userId: string, range: DateRange): Promise<ReportContext> {
    const [devices, scenarios, notifications, telemetry] = await Promise.all([
      this.home.listDevices(userId),
      this.home.listScenarios(userId),
      this.home.listNotifications(userId),
      this.home.listTelemetryRange(userId, range)
    ]);
    const scopedTelemetry = telemetry;
    const scopedNotifications = notifications.filter((item) => isInsideDateRange(item.createdAt, range));
    const temperatureSeries = scopedTelemetry.filter((item) => item.kind === "temperature").map((item) => ({ time: formatChartTime(item.createdAt), value: item.value }));
    const humiditySeries = scopedTelemetry.filter((item) => item.kind === "humidity").map((item) => ({ time: formatChartTime(item.createdAt), value: item.value }));
    const notificationStats = Object.entries(groupBy(scopedNotifications.map((item) => item.type))).map(([type, count]) => ({ type, count }));

    return {
      range,
      generatedAt: new Date().toISOString(),
      devices,
      manualDevices: devices.filter((device) => device.sourceKind === "manual"),
      sensors: devices.filter((device) => device.sourceKind !== "manual"),
      scenarios,
      notifications,
      telemetry,
      scopedTelemetry,
      scopedNotifications,
      temperatureSeries,
      humiditySeries,
      deviceActivity: devices.map((device) => ({
        name: device.name,
        enabled: device.enabled,
        online: device.online,
        events: scopedTelemetry.filter((item) => item.deviceId === device.id).length
      })),
      scenarioActivity: scenarios.map((scenario) => ({ title: scenario.title, active: scenario.active })),
      notificationStats
    };
  }

  async listNews(userId: string): Promise<NewsItem[]> {
    await this.home.getSubscription(userId);
    return this.news.listSmartHomeNews();
  }

  async getClimateSeries(userId: string, rangeInput: DateRangeInput): Promise<ClimateSeriesPayload> {
    const range = resolveDateRange(rangeInput);
    const telemetry = await this.home.listTelemetryRange(userId, range);
    return buildClimateSeries(range, telemetry);
  }

  async getDashboard(userId: string): Promise<DashboardSummary> {
    const automation = await this.runAutomationForUser(userId);
    const weather = automation.weather;
    const devices = automation.devices;
    const scenarios = await this.home.listScenarios(userId);
    const notifications = await this.home.listNotifications(userId);
    const subscription = await this.home.getSubscription(userId);
    const userDevices = devices.filter((device) => !device.isSystem && !isLegacyWeatherDeviceId(device.id));
    const temperature = weather?.temperature ?? null;
    const today = new Date().toISOString().slice(0, 10);
    const emptyHome = userDevices.length === 0;

    return {
      stats: {
        temperature,
        onlineDevices: userDevices.filter((device) => device.online).length,
        totalDevices: userDevices.length,
        activeScenarios: scenarios.filter((scenario) => scenario.triggerType === "automatic" && scenario.active).length,
        eventsToday: emptyHome ? 0 : notifications.filter((item) => item.createdAt.startsWith(today)).length,
        unreadNotifications: notifications.filter((item) => item.unread).length
      },
      activitySeries: emptyHome ? [] : buildActivitySeries(notifications),
      currentScenario: scenarios.find((scenario) => scenario.triggerType === "automatic" && scenario.active) ?? null,
      favoriteManualScenarios: scenarios.filter((scenario) => scenario.triggerType === "manual" && scenario.favorite && scenario.active),
      subscription,
      weather,
      scenarioEvaluation: buildScenarioEvaluation(
        scenarios.find((scenario) => scenario.triggerType === "automatic" && scenario.active) ?? null,
        devices
      )
    };
  }

  private async evaluateScenario(
    userId: string,
    scenario: Scenario,
    devices: Device[],
    telemetry: Awaited<ReturnType<HomeStore["listLatestTelemetry"]>>
  ): Promise<{ devices: Device[]; evaluation: ScenarioLastEvaluation }> {
    const target = scenario.targetDeviceId ? devices.find((device) => device.id === scenario.targetDeviceId) ?? null : null;
    const actual = getScenarioActualValue(scenario, telemetry);
    const evaluatedAt = new Date().toISOString();

    if (actual.status !== "ready") {
      const evaluation = {
        status: actual.status,
        actualValue: null,
        unit: actual.unit,
        reason: actual.reason,
        evaluatedAt,
        applied: false
      } satisfies ScenarioLastEvaluation;
      await this.home.updateScenarioEvaluation(userId, scenario.id, evaluation);
      return {
        devices,
        evaluation
      };
    }

    const matched = compareScenarioValue(actual.value, scenario.operator, scenario.value);
    let applied = false;
    let nextTarget = target;
    let nextDevices = devices;

    if (target && !isSystemDeviceId(target.id) && (scenario.command === "Включить" || scenario.command === "Выключить")) {
      const desiredEnabled = scenario.command === "Включить" ? matched : !matched;
      if (target.enabled !== desiredEnabled) {
        nextTarget = await this.home.updateDevice(userId, target.id, { enabled: desiredEnabled, online: true });
        if (nextTarget) {
          nextDevices = devices.map((device) => (device.id === nextTarget?.id ? nextTarget : device));
          applied = true;
          await this.home.createNotification(userId, `Сценарий "${scenario.title}" ${desiredEnabled ? "включил" : "выключил"} "${target.name}"`, "scenario", true);
          await this.trySendTelegram(userId, automaticScenarioAppliedMessage(scenario, target, desiredEnabled));
        }
      }
    }

    const evaluation = {
      status: matched ? "matched" : "not_matched",
      actualValue: actual.value,
      unit: actual.unit,
      reason: buildScenarioReason(scenario, actual.value, actual.unit, matched, applied),
      evaluatedAt,
      applied
    } satisfies ScenarioLastEvaluation;
    await this.home.updateScenarioEvaluation(userId, scenario.id, evaluation);

    return {
      devices: nextDevices,
      evaluation
    };
  }

  private async evaluateScheduleScenario(userId: string, scenario: Scenario, devices: Device[]): Promise<{ devices: Device[]; evaluation: ScenarioLastEvaluation }> {
    const target = scenario.targetDeviceId ? devices.find((device) => device.id === scenario.targetDeviceId) ?? null : null;
    const evaluatedAt = new Date().toISOString();

    if (!scenario.scheduleTime || !isValidScheduleTime(scenario.scheduleTime)) {
      const evaluation = {
        status: "unknown" as const,
        actualValue: null,
        unit: null,
        reason: "Не выбрано время запуска.",
        evaluatedAt,
        applied: false
      } satisfies ScenarioLastEvaluation;
      await this.home.updateScenarioEvaluation(userId, scenario.id, evaluation);
      return { devices, evaluation };
    }

    const timezone = scenario.scheduleTimezone ?? "Europe/Moscow";
    const now = new Date();
    const localParts = getLocalDateTimeParts(now, timezone);
    const dueNow = localParts.time === scenario.scheduleTime;
    const alreadyRanToday =
      scenario.lastScheduleRunAt !== null &&
      getLocalDateTimeParts(new Date(scenario.lastScheduleRunAt), timezone).date === localParts.date;

    if (!dueNow || alreadyRanToday) {
      const evaluation = {
        status: "not_matched" as const,
        actualValue: null,
        unit: null,
        reason: alreadyRanToday
          ? `Расписание на ${scenario.scheduleTime} сегодня уже выполнено.`
          : `Сейчас ${localParts.time}, запуск запланирован на ${scenario.scheduleTime}.`,
        evaluatedAt,
        applied: false
      } satisfies ScenarioLastEvaluation;
      await this.home.updateScenarioEvaluation(userId, scenario.id, evaluation);
      return { devices, evaluation };
    }

    if (scenario.command === "Установить значение") {
      const evaluation = {
        status: "unsupported" as const,
        actualValue: null,
        unit: null,
        reason: "Для сценария по времени выберите действие включения, выключения или инвертирования.",
        evaluatedAt,
        applied: false
      } satisfies ScenarioLastEvaluation;
      await this.home.updateScenarioEvaluation(userId, scenario.id, evaluation);
      return { devices, evaluation };
    }

    let applied = false;
    let nextDevices = devices;
    if (target && !isSystemDeviceId(target.id) && target.sourceKind === "manual") {
      const desiredEnabled = getDesiredEnabledFromCommand(scenario.command, target.enabled);
      if (desiredEnabled !== null && target.enabled !== desiredEnabled) {
        const nextTarget = await this.home.updateDevice(userId, target.id, { enabled: desiredEnabled, online: true });
        if (nextTarget) {
          nextDevices = devices.map((device) => (device.id === nextTarget.id ? nextTarget : device));
          applied = true;
          await this.home.createNotification(userId, `Сценарий "${scenario.title}" ${desiredEnabled ? "включил" : "выключил"} "${target.name}"`, "scenario", true);
          await this.trySendTelegram(userId, automaticScenarioAppliedMessage(scenario, target, desiredEnabled));
        }
      }
    }

    const evaluation = {
      status: "matched" as const,
      actualValue: null,
      unit: null,
      reason: applied
        ? `Наступило ${scenario.scheduleTime}, поэтому действие выполнено.`
        : `Наступило ${scenario.scheduleTime}, состояние уже было нужным.`,
      evaluatedAt,
      applied
    } satisfies ScenarioLastEvaluation;

    await this.home.updateScenario(userId, scenario.id, {
      lastScheduleRunAt: evaluatedAt
    });
    await this.home.updateScenarioEvaluation(userId, scenario.id, evaluation);

    return {
      devices: nextDevices,
      evaluation
    };
  }

  private async requirePremium(userId: string) {
    const subscription = await this.home.getSubscription(userId);
    if (!subscription.isPremium) {
      throw new Error("Функция доступна только по подписке SmartHome Premium");
    }
    return subscription;
  }

  private assertUserEditableDevice(deviceId: string, message: string) {
    if (isSystemDeviceId(deviceId)) {
      throw new Error(message);
    }
  }

  private async trySendTelegram(userId: string, message: string) {
    try {
      const subscription = await this.home.getSubscription(userId);
      if (!subscription.isPremium) return;
      await this.sendTelegram(userId, message);
    } catch {
      // Telegram must never break core smart home operations.
    }
  }

  private async sendTelegram(userId: string, message: string) {
    const secrets = await this.home.getTelegramSecrets(userId);
    if (!secrets) {
      throw new Error("Telegram-интеграция не подключена");
    }

    const botToken = decryptSecret(secrets.botTokenEncrypted);
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: secrets.chatId,
        text: message
      })
    });

    if (!response.ok) {
      throw new Error("Telegram не принял сообщение. Проверьте bot token и chat id");
    }
  }
}

function getSupportedScenarioMetrics(device: Device) {
  if (device.sourceKind === "home_sensor" && isHomeSensorMetric(device.sourceMetric)) {
    return [device.sourceMetric];
  }
  if (device.sourceKind === "open_meteo" && device.sourceMetric) {
    return [getOpenMeteoDefinition(device.sourceMetric as OpenMeteoMetric).kind];
  }
  return [];
}

function compareScenarioValue(actual: number, operator: ScenarioOperator, expected: number) {
  if (operator === ">") {
    return actual > expected;
  }

  if (operator === "<") {
    return actual < expected;
  }

  return actual === expected;
}

function getScenarioActualValue(scenario: Scenario, telemetry: Awaited<ReturnType<HomeStore["listLatestTelemetry"]>>) {
  if (!scenario.sourceDeviceId || !scenario.sourceMetric) {
    return {
      status: "unknown" as const,
      value: null,
      unit: scenario.unit,
      reason: "Не выбран источник данных."
    };
  }

  const latest = telemetry
    .filter((point) => point.deviceId === scenario.sourceDeviceId && point.kind === scenario.sourceMetric)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];

  if (!latest) {
    return {
      status: "unknown" as const,
      value: null,
      unit: scenario.unit,
      reason: "Нет данных от выбранного источника."
    };
  }

  if (scenario.command !== "Включить" && scenario.command !== "Выключить") {
    return {
      status: "unsupported" as const,
      value: latest.value,
      unit: latest.unit,
      reason: "Для этого действия автоматический откат пока недоступен."
    };
  }

  return {
    status: "ready" as const,
    value: latest.value,
    unit: latest.unit,
    reason: null
  };
}

function buildScenarioEvaluation(scenario: Scenario | null, devices: Device[]): ScenarioEvaluation | null {
  if (!scenario) {
    return null;
  }

  const target = scenario.targetDeviceId ? devices.find((device) => device.id === scenario.targetDeviceId) ?? null : null;
  return {
    scenario,
    status: scenario.lastEvaluation.status,
    actualValue: scenario.lastEvaluation.actualValue,
    unit: scenario.lastEvaluation.unit,
    targetDeviceId: scenario.targetDeviceId,
    targetDeviceName: scenario.targetDeviceName,
    targetEnabled: target?.enabled ?? null,
    applied: scenario.lastEvaluation.applied
  };
}

function buildScenarioReason(scenario: Scenario, actualValue: number, unit: string | null, matched: boolean, applied: boolean) {
  const symbol = scenario.operator;
  const value = `${actualValue}${unit ?? ""}`;
  const expected = `${scenario.value}${scenario.unit ?? ""}`;
  const relation =
    symbol === ">"
      ? matched
        ? "больше"
        : "не больше"
      : symbol === "<"
        ? matched
          ? "меньше"
          : "не меньше"
        : matched
          ? "равно"
          : "не равно";
  const actionText = matched
    ? applied
      ? "действие выполнено"
      : "состояние уже было нужным"
    : applied
      ? "состояние откатили"
      : "действие не выполнено";
  return `${value} ${relation} ${expected}, поэтому ${actionText}.`;
}

function isValidScheduleTime(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return false;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function getLocalDateTimeParts(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    time: `${read("hour")}:${read("minute")}`
  };
}

function getDesiredEnabledFromCommand(command: ScenarioCommand, currentEnabled: boolean | null) {
  if (command === "Включить") {
    return true;
  }
  if (command === "Выключить") {
    return false;
  }
  if (command === "Инвертировать" && currentEnabled !== null) {
    return !currentEnabled;
  }
  return null;
}

function normalizeActions(actions: Array<Omit<ScenarioAction, "id">>) {
  return actions
    .filter((action) => action.targetDeviceId && !isSystemDeviceId(action.targetDeviceId))
    .map((action, index) => ({ ...action, orderIndex: index }));
}

function buildManualTemplates(devices: Device[]) {
  const editableDevices = devices.filter((device) => !device.isSystem && device.sourceKind === "manual");
  const lights = editableDevices.filter((device) => device.category === "Освещение");
  const morningDevices = editableDevices.filter((device) => device.category === "Освещение" || device.category === "Климат");

  return [
    {
      title: "Включить свет в доме",
      triggerType: "manual" as const,
      favorite: true,
      metric: "Выключатель" as const,
      operator: "=" as const,
      value: 1,
      unit: null,
      targetDeviceId: null,
      targetDeviceName: "Несколько устройств",
      command: "Включить" as const,
      active: true,
      actions: lights.map((device, index) => ({
        targetDeviceId: device.id,
        targetDeviceName: device.name,
        command: "Включить" as const,
        orderIndex: index
      }))
    },
    {
      title: "Выключить все устройства",
      triggerType: "manual" as const,
      favorite: true,
      metric: "Выключатель" as const,
      operator: "=" as const,
      value: 1,
      unit: null,
      targetDeviceId: null,
      targetDeviceName: "Несколько устройств",
      command: "Выключить" as const,
      active: true,
      actions: editableDevices.map((device, index) => ({
        targetDeviceId: device.id,
        targetDeviceName: device.name,
        command: "Выключить" as const,
        orderIndex: index
      }))
    },
    {
      title: "Ночной режим",
      triggerType: "manual" as const,
      favorite: true,
      metric: "Выключатель" as const,
      operator: "=" as const,
      value: 1,
      unit: null,
      targetDeviceId: null,
      targetDeviceName: "Несколько устройств",
      command: "Выключить" as const,
      active: true,
      actions: editableDevices.map((device, index) => ({
        targetDeviceId: device.id,
        targetDeviceName: device.name,
        command: "Выключить" as const,
        orderIndex: index
      }))
    },
    {
      title: "Утренний режим",
      triggerType: "manual" as const,
      favorite: true,
      metric: "Выключатель" as const,
      operator: "=" as const,
      value: 1,
      unit: null,
      targetDeviceId: null,
      targetDeviceName: "Несколько устройств",
      command: "Включить" as const,
      active: true,
      actions: morningDevices.map((device, index) => ({
        targetDeviceId: device.id,
        targetDeviceName: device.name,
        command: "Включить" as const,
        orderIndex: index
      }))
    }
  ];
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

function groupBy(values: string[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function formatChartTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function buildClimateSeries(range: DateRange, telemetry: Awaited<ReturnType<HomeStore["listTelemetryRange"]>>): ClimateSeriesPayload {
  return {
    range,
    temperatureSeries: telemetry.filter((item) => item.kind === "temperature").map((item) => ({ at: item.createdAt, value: item.value })),
    humiditySeries: telemetry.filter((item) => item.kind === "humidity").map((item) => ({ at: item.createdAt, value: item.value }))
  };
}

function getReportDefinition(kind: ReportKind) {
  const definition = REPORT_DEFINITIONS.find((report) => report.kind === kind);
  if (!definition) {
    throw new Error("Отчет не найден");
  }
  return definition;
}

type ReportContext = {
  range: DateRange;
  generatedAt: string;
  devices: Device[];
  manualDevices: Device[];
  sensors: Device[];
  scenarios: Scenario[];
  notifications: Awaited<ReturnType<HomeStore["listNotifications"]>>;
  telemetry: Awaited<ReturnType<HomeStore["listTelemetryRange"]>>;
  scopedTelemetry: Awaited<ReturnType<HomeStore["listTelemetryRange"]>>;
  scopedNotifications: Awaited<ReturnType<HomeStore["listNotifications"]>>;
  temperatureSeries: Array<{ time: string; value: number }>;
  humiditySeries: Array<{ time: string; value: number }>;
  deviceActivity: Array<{ name: string; enabled: boolean; online: boolean; events: number }>;
  scenarioActivity: Array<{ title: string; active: boolean }>;
  notificationStats: Array<{ type: string; count: number }>;
};

function buildReportPayload(
  kind: ReportKind,
  definition: Omit<ReportCatalogItem, "available">,
  context: ReportContext,
  parameters: ReportParameters
): ReportPayload {
  const period = formatRangeLabel(context.range);
  const onlineDevices = context.manualDevices.filter((device) => device.online).length;
  const activeScenarios = context.scenarios.filter((scenario) => scenario.active).length;
  const topDevice = getDeviceActivity(context)[0] ?? null;
  const base = {
    kind,
    title: definition.title,
    description: definition.description,
    premiumOnly: definition.premiumOnly,
    range: context.range,
    generatedAt: context.generatedAt,
    parameters
  };

  if (kind === "home_summary") {
    return {
      ...base,
      summary: `За ${period}: устройств на связи ${onlineDevices}/${context.manualDevices.length}, активных сценариев ${activeScenarios}, уведомлений ${context.scopedNotifications.length}.`,
      blocks: [
        metricsBlock("Ключевые показатели", [
          { label: "Устройства", value: `${onlineDevices}/${context.manualDevices.length}`, subtitle: "на связи" },
          { label: "Сценарии", value: String(activeScenarios), subtitle: "активных" },
          { label: "Уведомления", value: String(context.scopedNotifications.length), subtitle: "за период" },
          { label: "Датчики", value: String(context.sensors.length), subtitle: "источников данных" }
        ]),
        lineBlock("Климат дома", "Температура и влажность за выбранный период", [
          series("Температура", "°C", context.temperatureSeries),
          series("Влажность", "%", context.humiditySeries)
        ]),
        barBlock("События по типам", "Что происходило чаще всего", context.notificationStats.map((item) => ({ label: notificationLabel(item.type), value: item.count })))
      ]
    };
  }

  if (kind === "device_activity") {
    const rows = getDeviceActivity(context);
    return {
      ...base,
      summary: `За ${period} активнее всего работало устройство "${topDevice?.device.name ?? "—"}": ${topDevice?.events ?? 0} событий.`,
      blocks: [
        metricsBlock("Активность устройств", [
          { label: "Устройств", value: String(context.manualDevices.length), subtitle: "в доме" },
          { label: "На связи", value: String(onlineDevices), subtitle: "сейчас" },
          { label: "Лидер", value: topDevice?.device.name ?? "—", subtitle: `${topDevice?.events ?? 0} событий` }
        ]),
        barBlock("Рейтинг устройств", "События за период", rows.map((item) => ({ label: item.device.name, value: item.events }))),
        tableBlock(
          "Состояние устройств",
          "Текущий статус и число событий",
          ["Устройство", "Комната", "Состояние", "Событий"],
          rows.map((item) => [item.device.name, item.device.room, item.device.enabled ? "Включено" : "Выключено", String(item.events)])
        )
      ]
    };
  }

  if (kind === "home_climate") {
    return {
      ...base,
      summary: `За ${period} собрано ${context.temperatureSeries.length} температурных и ${context.humiditySeries.length} влажностных точек.`,
      blocks: [
        metricsBlock("Климатические показатели", [
          metricFromValues("Средняя температура", context.temperatureSeries.map((item) => item.value), "°C"),
          metricFromValues("Средняя влажность", context.humiditySeries.map((item) => item.value), "%"),
          metricFromValues("Минимум", context.temperatureSeries.map((item) => item.value), "°C", (items) => Math.min(...items)),
          metricFromValues("Максимум", context.temperatureSeries.map((item) => item.value), "°C", (items) => Math.max(...items))
        ]),
        lineBlock("Температура и влажность", "Показания датчиков за период", [
          series("Температура", "°C", context.temperatureSeries),
          series("Влажность", "%", context.humiditySeries)
        ])
      ]
    };
  }

  if (kind === "scenario_activity") {
    const scenarioCounts = [
      { label: "Активные", value: context.scenarios.filter((scenario) => scenario.active).length },
      { label: "Выключенные", value: context.scenarios.filter((scenario) => !scenario.active).length },
      { label: "Автоматические", value: context.scenarios.filter((scenario) => scenario.triggerType === "automatic").length },
      { label: "Ручные", value: context.scenarios.filter((scenario) => scenario.triggerType === "manual").length }
    ];
    return {
      ...base,
      summary: `За ${period} в системе ${context.scenarios.length} сценариев, из них активны ${activeScenarios}.`,
      blocks: [
        barBlock("Структура сценариев", "Какие режимы настроены", scenarioCounts),
        tableBlock(
          "Последние результаты",
          "Что проверяли сценарии",
          ["Сценарий", "Тип", "Статус", "Последняя проверка"],
          context.scenarios.map((scenario) => [
            scenario.title,
            scenario.triggerType === "manual" ? "Ручной" : scenario.automationSource === "schedule" ? "По времени" : "По датчику",
            scenario.active ? "Активен" : "Выключен",
            scenario.lastEvaluation.evaluatedAt ? formatChartTime(scenario.lastEvaluation.evaluatedAt) : "—"
          ])
        )
      ]
    };
  }

  if (kind === "notifications") {
    return {
      ...base,
      summary: `За ${period} зарегистрировано ${context.scopedNotifications.length} уведомлений по дому.`,
      blocks: [
        barBlock("Уведомления по типам", "Распределение событий", context.notificationStats.map((item) => ({ label: notificationLabel(item.type), value: item.count }))),
        tableBlock(
          "Последние уведомления",
          "Свежая лента событий",
          ["Событие", "Тип", "Дата"],
          context.scopedNotifications.slice(-8).reverse().map((item) => [item.title, notificationLabel(item.type), formatChartTime(item.createdAt)])
        )
      ]
    };
  }

  if (kind === "device_detail") {
    const device = requireManualDevice(context, parameters.deviceId);
    const points = context.scopedTelemetry.filter((item) => item.deviceId === device.id);
    return {
      ...base,
      summary: `За ${period} устройство "${device.name}" зафиксировало ${points.length} событий и сейчас ${device.enabled ? "включено" : "выключено"}.`,
      blocks: [
        metricsBlock("Устройство", [
          { label: "Состояние", value: device.enabled ? "Включено" : "Выключено", subtitle: device.online ? "на связи" : "offline" },
          { label: "Комната", value: device.room, subtitle: device.category },
          { label: "Событий", value: String(points.length), subtitle: "за период" }
        ]),
        barBlock("События по дням", "Активность выбранного устройства", buildDailyTelemetryBars(points)),
        tableBlock(
          "Последняя телеметрия",
          "Точки, связанные с устройством",
          ["Метрика", "Значение", "Время"],
          points.slice(-8).reverse().map((item) => [item.kind, formatTelemetryValue(item.value, item.unit), formatChartTime(item.createdAt)])
        )
      ]
    };
  }

  if (kind === "sensor_detail") {
    const sensor = requireSensor(context, parameters.sensorId);
    const metricKind = getPrimaryMetricKind(sensor);
    const points = metricKind ? context.scopedTelemetry.filter((item) => item.deviceId === sensor.id && item.kind === metricKind) : [];
    const values = points.map((item) => item.value);
    return {
      ...base,
      summary: `За ${period} датчик "${sensor.name}" передал ${points.length} показаний.`,
      blocks: [
        metricsBlock("Датчик", [
          { label: "Последнее", value: values.length ? formatTelemetryValue(values.at(-1) ?? 0, points.at(-1)?.unit ?? null) : "—", subtitle: sensor.room },
          metricFromValues("Среднее", values, points[0]?.unit ?? null),
          metricFromValues("Минимум", values, points[0]?.unit ?? null, (items) => Math.min(...items)),
          metricFromValues("Максимум", values, points[0]?.unit ?? null, (items) => Math.max(...items))
        ]),
        lineBlock(sensor.name, "Динамика выбранного датчика", [series(sensor.name, points[0]?.unit ?? null, points.map((item) => ({ time: formatChartTime(item.createdAt), value: item.value })))])
      ]
    };
  }

  if (kind === "room_comparison") {
    const roomA = requireRoom(context, parameters.roomA, "Комната A");
    const roomB = requireRoom(context, parameters.roomB, "Комната B");
    if (roomA === roomB) {
      throw new Error("Для сравнения выберите две разные комнаты");
    }
    const roomStats = [buildRoomStats(context, roomA), buildRoomStats(context, roomB)];
    return {
      ...base,
      summary: `За ${period} сравниваются комнаты "${roomA}" и "${roomB}".`,
      blocks: [
        metricsBlock("Сравнение комнат", roomStats.map((item) => ({ label: item.room, value: `${item.events} событий`, subtitle: `${item.devices} устройств` }))),
        barBlock("События по комнатам", "Где дом был активнее", roomStats.map((item) => ({ label: item.room, value: item.events }))),
        tableBlock(
          "Климат по комнатам",
          "Средние значения по доступным датчикам",
          ["Комната", "Температура", "Влажность"],
          roomStats.map((item) => [item.room, formatAverage(item.temperature, "°C"), formatAverage(item.humidity, "%")])
        )
      ]
    };
  }

  if (kind === "indoor_outdoor") {
    const indoor = buildSourceClimate(context, "home_sensor");
    const outdoor = buildSourceClimate(context, "open_meteo");
    return {
      ...base,
      summary: `За ${period} можно сравнить климат дома и на улице по доступным датчикам.`,
      blocks: [
        metricsBlock("Дом и улица", [
          { label: "Дом", value: formatAverage(indoor.temperature, "°C"), subtitle: `влажность ${formatAverage(indoor.humidity, "%")}` },
          { label: "Улица", value: formatAverage(outdoor.temperature, "°C"), subtitle: `влажность ${formatAverage(outdoor.humidity, "%")}` }
        ]),
        lineBlock("Температура внутри и снаружи", "Сопоставление показаний", [
          series("Дом", "°C", indoor.temperatureSeries),
          series("Улица", "°C", outdoor.temperatureSeries)
        ])
      ]
    };
  }

  const hourly = buildHourlyActivity(context.scopedNotifications);
  const peak = hourly.reduce((best, item) => (item.value > best.value ? item : best), hourly[0] ?? { label: "—", value: 0 });
  return {
    ...base,
    summary: `За ${period} пик активности пришелся на ${peak.label}: ${peak.value} событий.`,
    blocks: [
      metricsBlock("Пиковые часы", [
        { label: "Пик", value: peak.label, subtitle: `${peak.value} событий` },
        { label: "Всего", value: String(context.scopedNotifications.length), subtitle: "событий" }
      ]),
      barBlock("Активность по часам", "Когда дом менял состояние чаще всего", hourly)
    ]
  };
}

function metricsBlock(title: string, items: Array<{ label: string; value: string; subtitle: string }>): ReportBlock {
  return { type: "metrics", title, items };
}

function lineBlock(title: string, description: string, seriesItems: Array<{ label: string; unit: string | null; points: Array<{ label: string; value: number }> }>): ReportBlock {
  return { type: "line_chart", title, description, series: seriesItems };
}

function barBlock(title: string, description: string, items: Array<{ label: string; value: number }>): ReportBlock {
  return { type: "bar_chart", title, description, items };
}

function tableBlock(title: string, description: string, columns: string[], rows: string[][]): ReportBlock {
  return { type: "table", title, description, columns, rows };
}

function series(label: string, unit: string | null, points: Array<{ time: string; value: number }>) {
  return { label, unit, points: points.map((point) => ({ label: point.time, value: point.value })) };
}

function metricFromValues(label: string, values: number[], unit: string | null, reducer: (values: number[]) => number = (items) => average(items) ?? 0) {
  if (values.length === 0) {
    return { label, value: "—", subtitle: "нет данных" };
  }
  return { label, value: formatTelemetryValue(reducer(values), unit), subtitle: `${values.length} точек` };
}

function getDeviceActivity(context: ReportContext) {
  return context.manualDevices
    .map((device) => ({
      device,
      events: context.scopedTelemetry.filter((item) => item.deviceId === device.id).length
    }))
    .sort((left, right) => right.events - left.events);
}

function requireManualDevice(context: ReportContext, id?: string | null) {
  if (!id) {
    throw new Error("Для отчета по устройству выберите устройство");
  }
  const device = context.manualDevices.find((item) => item.id === id);
  if (!device) {
    throw new Error("Устройство для отчета не найдено");
  }
  return device;
}

function requireSensor(context: ReportContext, id?: string | null) {
  if (!id) {
    throw new Error("Для отчета по датчику выберите датчик");
  }
  const sensor = context.sensors.find((item) => item.id === id);
  if (!sensor) {
    throw new Error("Датчик для отчета не найден");
  }
  return sensor;
}

function requireRoom(context: ReportContext, room?: string | null, label = "Комната") {
  if (!room) {
    throw new Error(`Для сравнения выберите поле "${label}"`);
  }
  if (!context.devices.some((device) => device.room === room)) {
    throw new Error(`Комната "${room}" не найдена`);
  }
  return room;
}

function buildDailyTelemetryBars(points: Awaited<ReturnType<HomeStore["listTelemetryRange"]>>) {
  const days = new Map<string, number>();
  points.forEach((point) => {
    const key = point.createdAt.slice(0, 10);
    days.set(key, (days.get(key) ?? 0) + 1);
  });
  return Array.from(days.entries()).map(([day, value]) => ({ label: formatDate(day), value }));
}

function buildRoomStats(context: ReportContext, room: string) {
  const devices = context.devices.filter((device) => device.room === room);
  const ids = new Set(devices.map((device) => device.id));
  const telemetry = context.scopedTelemetry.filter((item) => ids.has(item.deviceId));
  return {
    room,
    devices: devices.length,
    events: telemetry.length,
    temperature: average(telemetry.filter((item) => item.kind === "temperature").map((item) => item.value)),
    humidity: average(telemetry.filter((item) => item.kind === "humidity").map((item) => item.value))
  };
}

function buildSourceClimate(context: ReportContext, sourceKind: Device["sourceKind"]) {
  const ids = new Set(context.devices.filter((device) => device.sourceKind === sourceKind).map((device) => device.id));
  const telemetry = context.scopedTelemetry.filter((item) => ids.has(item.deviceId));
  return {
    temperature: average(telemetry.filter((item) => item.kind === "temperature").map((item) => item.value)),
    humidity: average(telemetry.filter((item) => item.kind === "humidity").map((item) => item.value)),
    temperatureSeries: telemetry.filter((item) => item.kind === "temperature").map((item) => ({ time: formatChartTime(item.createdAt), value: item.value }))
  };
}

function buildHourlyActivity(notifications: Awaited<ReturnType<HomeStore["listNotifications"]>>) {
  const counts = Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2, "0")}:00`, value: 0 }));
  notifications.forEach((notification) => {
    const hour = new Date(notification.createdAt).getHours();
    counts[hour].value += 1;
  });
  return counts;
}

function getPrimaryMetricKind(device: Device) {
  if (device.sourceKind === "home_sensor") {
    return device.sourceMetric;
  }
  if (device.sourceKind === "open_meteo" && device.sourceMetric) {
    return getOpenMeteoDefinition(device.sourceMetric as OpenMeteoMetric).kind;
  }
  return null;
}

function formatTelemetryValue(value: number, unit: string | null) {
  const formatted = Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  return `${formatted}${unit ?? ""}`;
}

function formatAverage(value: number | null, unit: string | null) {
  return value === null ? "—" : formatTelemetryValue(value, unit);
}

function renderReportPdf(report: ReportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({ margin: 0, size: "A4" });
    const fonts = setupReportFonts(document);

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    paintReportPage(document, fonts);

    let cursorY = drawReportHero(document, fonts, report);
    cursorY = drawSummaryCard(document, fonts, report, cursorY + 18);

    for (const block of report.blocks) {
      const height = getReportBlockHeight(block);
      cursorY = ensureReportSpace(document, fonts, cursorY + 18, height);
      cursorY = drawReportBlock(document, fonts, block, cursorY);
    }

    document.end();
  });
}

type PdfDocument = InstanceType<typeof PDFDocument>;
type ReportFonts = {
  regular: string;
  bold: string;
};

const reportColors = {
  background: "#09090B",
  card: "#111217",
  cardSoft: "#17151F",
  border: "#2A2B33",
  text: "#F8FAFC",
  muted: "#A1A1AA",
  subtle: "#71717A",
  violet: "#8B5CF6",
  violetDark: "#4C1D95",
  emerald: "#34D399",
  red: "#F87171",
  amber: "#FBBF24",
  grid: "#27272A"
};

function setupReportFonts(document: PdfDocument): ReportFonts {
  const regularPath = fileURLToPath(new URL("../../assets/fonts/DejaVuSans.ttf", import.meta.url));
  const boldPath = fileURLToPath(new URL("../../assets/fonts/DejaVuSans-Bold.ttf", import.meta.url));

  if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
    throw new Error("Не найдены локальные шрифты PDF");
  }

  document.registerFont("ReportRegular", regularPath);
  document.registerFont("ReportBold", boldPath);

  return {
    regular: "ReportRegular",
    bold: "ReportBold"
  };
}

function paintReportPage(document: PdfDocument, fonts: ReportFonts) {
  const { width, height } = document.page;
  document.save();
  document.rect(0, 0, width, height).fill(reportColors.background);
  document.rect(0, 0, width, 11).fill(reportColors.violet);
  document.circle(width - 74, 72, 44).fill("#171022");
  document.circle(width - 36, 122, 22).fill("#10231D");
  document.font(fonts.regular).fontSize(8).fillColor(reportColors.subtle).text("SmartHome Premium Analytics", 40, height - 30);
  document.fillColor(reportColors.subtle).text(formatDateTime(new Date().toISOString()), width - 205, height - 30, { width: 165, align: "right" });
  document.restore();
}

function drawReportHero(document: PdfDocument, fonts: ReportFonts, report: ReportPayload) {
  const x = 40;
  const y = 38;
  const width = document.page.width - 80;
  const height = 116;

  roundedCard(document, x, y, width, height, reportColors.cardSoft);
  document.roundedRect(x + 22, y + 24, 44, 44, 16).fill(reportColors.violetDark);
  document.font(fonts.bold).fontSize(22).fillColor(reportColors.text).text("SmartHome", x + 82, y + 25);
  document.font(fonts.regular).fontSize(12).fillColor(reportColors.muted).text(report.title, x + 82, y + 55);
  document.font(fonts.regular).fontSize(10).fillColor(reportColors.subtle).text(`Сформировано: ${formatDateTime(report.generatedAt)}`, x + 82, y + 78);

  drawBadge(document, fonts, x + width - 152, y + 26, formatRangeLabel(report.range), reportColors.violetDark, reportColors.text);
  drawBadge(document, fonts, x + width - 152, y + 63, "PDF отчет", "#10231D", reportColors.emerald);

  document.font(fonts.bold).fontSize(24).fillColor(reportColors.text).text("⌁", x + 35, y + 32, { width: 18, align: "center" });
  return y + height;
}

function drawMetricCard(
  document: PdfDocument,
  fonts: ReportFonts,
  x: number,
  y: number,
  width: number,
  card: { title: string; value: string; subtitle: string; accent: string }
) {
  roundedCard(document, x, y, width, 84, reportColors.card);
  document.roundedRect(x + width - 34, y + 15, 18, 18, 7).fill(card.accent);
  document.font(fonts.regular).fontSize(9).fillColor(reportColors.muted).text(card.title, x + 14, y + 15, { width: width - 56 });
  document.font(fonts.bold).fontSize(21).fillColor(reportColors.text).text(card.value, x + 14, y + 34, { width: width - 28 });
  document.font(fonts.regular).fontSize(8).fillColor(reportColors.subtle).text(card.subtitle, x + 14, y + 62, { width: width - 28 });
}

function drawSummaryCard(document: PdfDocument, fonts: ReportFonts, report: ReportPayload, y: number) {
  const x = 40;
  const width = document.page.width - 80;
  roundedCard(document, x, y, width, 76, reportColors.card);
  document.font(fonts.bold).fontSize(13).fillColor(reportColors.text).text("Краткий вывод", x + 18, y + 16);
  document.font(fonts.regular).fontSize(10).fillColor(reportColors.muted).text(report.summary, x + 18, y + 39, { width: width - 36, lineGap: 3 });
  return y + 76;
}

function getReportBlockHeight(block: ReportBlock) {
  if (block.type === "metrics") {
    return 132;
  }
  if (block.type === "line_chart") {
    return 184;
  }
  if (block.type === "bar_chart") {
    return 72 + Math.max(block.items.length, 1) * 22;
  }
  return 72 + Math.max(block.rows.length, 1) * 22;
}

function drawReportBlock(document: PdfDocument, fonts: ReportFonts, block: ReportBlock, y: number) {
  if (block.type === "metrics") {
    return drawMetricsBlock(document, fonts, block, y);
  }
  if (block.type === "line_chart") {
    return drawLineChartBlock(document, fonts, block, y);
  }
  if (block.type === "bar_chart") {
    return drawBarChartBlock(document, fonts, block, y);
  }
  return drawTableBlock(document, fonts, block, y);
}

function drawMetricsBlock(document: PdfDocument, fonts: ReportFonts, block: Extract<ReportBlock, { type: "metrics" }>, y: number) {
  const x = 40;
  const width = document.page.width - 80;
  roundedCard(document, x, y, width, 132, reportColors.card);
  document.font(fonts.bold).fontSize(13).fillColor(reportColors.text).text(block.title, x + 18, y + 16);
  const gap = 10;
  const cardWidth = (width - 36 - gap * Math.max(block.items.length - 1, 0)) / Math.max(block.items.length, 1);
  block.items.forEach((item, index) => {
    drawMetricCard(document, fonts, x + 18 + index * (cardWidth + gap), y + 38, cardWidth, {
      title: item.label,
      value: item.value,
      subtitle: item.subtitle,
      accent: [reportColors.emerald, reportColors.violet, reportColors.amber, reportColors.red][index % 4]
    });
  });
  return y + 132;
}

function drawLineChartBlock(document: PdfDocument, fonts: ReportFonts, block: Extract<ReportBlock, { type: "line_chart" }>, y: number) {
  const x = 40;
  const width = document.page.width - 80;
  const height = 184;
  roundedCard(document, x, y, width, height, reportColors.card);
  document.font(fonts.bold).fontSize(13).fillColor(reportColors.text).text(block.title, x + 18, y + 16);
  document.font(fonts.regular).fontSize(9).fillColor(reportColors.subtle).text(block.description, x + 18, y + 36);

  const chartX = x + 42;
  const chartY = y + 68;
  const chartWidth = width - 72;
  const chartHeight = 82;
  block.series.slice(0, 2).forEach((item, index) => {
    drawLineChart(document, fonts, item.points.slice(-12), chartX, chartY, chartWidth, chartHeight, index === 0 ? reportColors.emerald : reportColors.violet, index === 0);
  });
  drawLegend(document, fonts, block.series.slice(0, 2), x + 18, y + height - 28);
  return y + height;
}

function drawLineChart(
  document: PdfDocument,
  fonts: ReportFonts,
  points: Array<{ label: string; value: number }>,
  x: number,
  y: number,
  width: number,
  height: number,
  color = reportColors.emerald,
  drawGuides = true
) {
  if (drawGuides) {
    for (let index = 0; index <= 3; index += 1) {
      const lineY = y + (height / 3) * index;
      document.moveTo(x, lineY).lineTo(x + width, lineY).lineWidth(0.6).strokeColor(reportColors.grid).stroke();
    }
  }

  if (points.length === 0) {
    document.font(fonts.regular).fontSize(10).fillColor(reportColors.subtle).text("Недостаточно данных для графика", x, y + height / 2 - 6, { width, align: "center" });
    return;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((point, index) => ({
    x: x + (points.length === 1 ? width / 2 : (width / (points.length - 1)) * index),
    y: y + height - ((point.value - min) / span) * height,
    point
  }));

  document.moveTo(coords[0].x, coords[0].y);
  coords.slice(1).forEach((coord) => document.lineTo(coord.x, coord.y));
  document.lineWidth(2.5).strokeColor(color).stroke();
  coords.forEach((coord) => document.circle(coord.x, coord.y, 3).fill(color));

  if (drawGuides) {
    document.font(fonts.regular).fontSize(8).fillColor(reportColors.subtle).text(String(max), x - 30, y - 2, { width: 24, align: "right" });
    document.text(String(min), x - 30, y + height - 8, { width: 24, align: "right" });
    document.text(points[0].label, x, y + height + 12, { width: 120 });
    document.text(points.at(-1)?.label ?? "", x + width - 120, y + height + 12, { width: 120, align: "right" });
  }
}

function drawLegend(document: PdfDocument, fonts: ReportFonts, seriesItems: Array<{ label: string }>, x: number, y: number) {
  seriesItems.forEach((item, index) => {
    const offset = index * 120;
    document.roundedRect(x + offset, y + 2, 10, 10, 5).fill(index === 0 ? reportColors.emerald : reportColors.violet);
    document.font(fonts.regular).fontSize(8).fillColor(reportColors.muted).text(item.label, x + offset + 16, y, { width: 96 });
  });
}

function drawBarChartBlock(document: PdfDocument, fonts: ReportFonts, block: Extract<ReportBlock, { type: "bar_chart" }>, y: number) {
  const x = 40;
  const width = document.page.width - 80;
  const rows = block.items.slice(0, 10);
  const height = getReportBlockHeight(block);
  roundedCard(document, x, y, width, height, reportColors.card);
  document.font(fonts.bold).fontSize(13).fillColor(reportColors.text).text(block.title, x + 18, y + 16);
  document.font(fonts.regular).fontSize(9).fillColor(reportColors.subtle).text(block.description, x + 18, y + 36);

  if (rows.length === 0) {
    document.font(fonts.regular).fontSize(10).fillColor(reportColors.subtle).text("Нет данных", x + 18, y + 68);
    return y + height;
  }

  const maxCount = Math.max(...rows.map((item) => item.value), 1);
  rows.forEach((item, index) => {
    const rowY = y + 62 + index * 22;
    const barWidth = Math.max(8, ((width - 190) * item.value) / maxCount);
    document.font(fonts.regular).fontSize(9).fillColor(reportColors.text).text(item.label, x + 18, rowY, { width: 128, ellipsis: true });
    document.roundedRect(x + 152, rowY + 2, width - 190, 8, 4).fill("#27272A");
    document.roundedRect(x + 152, rowY + 2, barWidth, 8, 4).fill(reportColors.violet);
    document.font(fonts.bold).fontSize(9).fillColor(reportColors.muted).text(String(item.value), x + width - 28, rowY - 1, { width: 14, align: "right" });
  });

  return y + height;
}

function drawTableBlock(document: PdfDocument, fonts: ReportFonts, block: Extract<ReportBlock, { type: "table" }>, y: number) {
  const x = 40;
  const width = document.page.width - 80;
  const rows = block.rows.slice(0, 10);
  const height = getReportBlockHeight(block);

  roundedCard(document, x, y, width, height, reportColors.card);
  document.font(fonts.bold).fontSize(13).fillColor(reportColors.text).text(block.title, x + 18, y + 16);
  document.font(fonts.regular).fontSize(9).fillColor(reportColors.subtle).text(block.description, x + 18, y + 36);
  if (rows.length === 0) {
    document.font(fonts.regular).fontSize(10).fillColor(reportColors.subtle).text("Нет данных", x + 18, y + 68, { width: width - 36 });
    return y + height;
  }

  const columnWidth = (width - 36) / block.columns.length;
  block.columns.forEach((column, index) => {
    document.font(fonts.bold).fontSize(8).fillColor(reportColors.muted).text(column, x + 18 + index * columnWidth, y + 58, {
      width: columnWidth - 8,
      ellipsis: true
    });
  });
  rows.forEach((row, rowIndex) => {
    const rowY = y + 80 + rowIndex * 22;
    row.forEach((cell, cellIndex) => {
      document.font(fonts.regular).fontSize(8).fillColor(reportColors.text).text(cell, x + 18 + cellIndex * columnWidth, rowY, {
        width: columnWidth - 8,
        ellipsis: true
      });
    });
  });
  return y + height;
}

function roundedCard(document: PdfDocument, x: number, y: number, width: number, height: number, fill: string) {
  document.roundedRect(x, y, width, height, 18).fill(fill);
  document.roundedRect(x, y, width, height, 18).lineWidth(0.8).strokeColor(reportColors.border).stroke();
}

function drawBadge(document: PdfDocument, fonts: ReportFonts, x: number, y: number, label: string, fill: string, text: string) {
  const width = Math.max(58, document.font(fonts.bold).fontSize(8).widthOfString(label) + 22);
  document.roundedRect(x, y, width, 22, 11).fill(fill);
  document.font(fonts.bold).fontSize(8).fillColor(text).text(label, x + 11, y + 6, { width: width - 22, align: "center" });
}

function ensureReportSpace(document: PdfDocument, fonts: ReportFonts, y: number, neededHeight: number) {
  if (y + neededHeight <= document.page.height - 50) {
    return y;
  }
  document.addPage({ margin: 0, size: "A4" });
  paintReportPage(document, fonts);
  return 44;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function notificationLabel(type: string) {
  const dictionary: Record<string, string> = {
    temperature: "Температура",
    motion: "Движение",
    system: "Система",
    device: "Устройства",
    scenario: "Сценарии"
  };
  return dictionary[type] ?? type;
}
