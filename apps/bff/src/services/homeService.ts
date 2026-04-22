import { collectorClient, type CollectorClient } from "../adapters/grpc/collectorClient.js";
import type {
  DashboardSummary,
  Device,
  DeviceCategory,
  DeviceType,
  NewsItem,
  QuickActionKind,
  ReportSummary,
  Scenario,
  ScenarioCommand,
  ScenarioMetric,
  ScenarioOperator,
  Subscription,
  TelegramIntegration
} from "../domain/types.js";
import type { HomeStore } from "../repositories/contracts.js";
import { decryptSecret, encryptSecret } from "./secretService.js";
import { NewsService } from "./newsService.js";
import PDFDocument from "pdfkit";
import fs from "node:fs";

export class HomeService {
  constructor(
    private readonly home: HomeStore,
    private readonly collector: CollectorClient = collectorClient,
    private readonly news = new NewsService()
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
    await this.trySendTelegram(userId, `Создан сценарий "${scenario.title}": ${scenario.condition} -> ${scenario.action}`);
    return scenario;
  }

  async updateScenario(
    userId: string,
    id: string,
    input: Partial<Pick<Scenario, "title" | "metric" | "operator" | "value" | "unit" | "targetDeviceId" | "targetDeviceName" | "command" | "active">>
  ) {
    const scenario = await this.home.updateScenario(userId, id, input);
    if (scenario) {
      await this.trySendTelegram(userId, `Обновлен сценарий "${scenario.title}". Статус: ${scenario.active ? "активен" : "выключен"}`);
    }
    return scenario;
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

    const previousMetric = device.metric;
    const point = await this.home.createTelemetry(userId, {
      deviceId,
      kind: input.kind,
      value: input.value,
      unit: input.unit
    });

    await this.trySync(userId, () => this.collector.sendTelemetry(device, input), "Телеметрия сохранена локально, но collector недоступен");
    const nextMetric = `${input.value}${input.unit ?? ""}`;
    await this.trySendTelegram(userId, `Телеметрия "${device.name}" изменилась: ${previousMetric ?? "нет данных"} -> ${nextMetric}`);
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
    await this.trySendTelegram(userId, `Подписка SmartHome Premium активирована до ${formatDate(expiresAt.toISOString())}`);
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
    await this.trySendTelegram(userId, `Продление SmartHome Premium отключено. Доступ открыт до ${formatDate(current.expiresAt)}`);
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
    await this.sendTelegram(userId, "Тестовое сообщение SmartHome: Telegram-интеграция подключена.");
    return { sent: true };
  }

  async getReportSummary(userId: string, range: ReportSummary["range"]): Promise<ReportSummary> {
    await this.requirePremium(userId);
    const [devices, scenarios, notifications, telemetry] = await Promise.all([
      this.home.listDevices(userId),
      this.home.listScenarios(userId),
      this.home.listNotifications(userId),
      this.home.listTelemetry(userId)
    ]);
    const cutoff = Date.now() - (range === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;
    const scopedTelemetry = telemetry.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
    const scopedNotifications = notifications.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
    const temperatureSeries = scopedTelemetry.filter((item) => item.kind === "temperature").map((item) => ({ time: formatChartTime(item.createdAt), value: item.value }));
    const humiditySeries = scopedTelemetry.filter((item) => item.kind === "humidity").map((item) => ({ time: formatChartTime(item.createdAt), value: item.value }));
    const notificationStats = Object.entries(groupBy(scopedNotifications.map((item) => item.type))).map(([type, count]) => ({ type, count }));

    return {
      range,
      generatedAt: new Date().toISOString(),
      temperatureSeries,
      humiditySeries,
      deviceActivity: devices.map((device) => ({
        name: device.name,
        enabled: device.enabled,
        online: device.online,
        events: scopedTelemetry.filter((item) => item.deviceId === device.id).length
      })),
      scenarioActivity: scenarios.map((scenario) => ({ title: scenario.title, active: scenario.active })),
      notificationStats,
      summary: `За период ${range === "7d" ? "7 дней" : "30 дней"}: устройств на связи ${devices.filter((device) => device.online).length}/${devices.length}, активных сценариев ${scenarios.filter((scenario) => scenario.active).length}, уведомлений ${scopedNotifications.length}.`
    };
  }

  async getReportPdf(userId: string, range: ReportSummary["range"]): Promise<Buffer> {
    const report = await this.getReportSummary(userId, range);
    return renderReportPdf(report);
  }

  async listNews(userId: string): Promise<NewsItem[]> {
    const subscription = await this.home.getSubscription(userId);
    if (subscription.isPremium) {
      return [];
    }
    return this.news.listItNews();
  }

  async getDashboard(userId: string): Promise<DashboardSummary> {
    const devices = await this.home.listDevices(userId);
    const scenarios = await this.home.listScenarios(userId);
    const notifications = await this.home.listNotifications(userId);
    const telemetry = await this.home.listTelemetry(userId);
    const subscription = await this.home.getSubscription(userId);
    const deviceIds = new Set(devices.map((device) => device.id));
    const deviceTelemetry = telemetry.filter((item) => deviceIds.has(item.deviceId));
    const temperature = deviceTelemetry.filter((item) => item.kind === "temperature").at(-1)?.value ?? null;
    const today = new Date().toISOString().slice(0, 10);
    const emptyHome = devices.length === 0;

    return {
      stats: {
        temperature,
        onlineDevices: devices.filter((device) => device.online).length,
        totalDevices: devices.length,
        activeScenarios: scenarios.filter((scenario) => scenario.active).length,
        eventsToday: emptyHome ? 0 : notifications.filter((item) => item.createdAt.startsWith(today)).length,
        unreadNotifications: notifications.filter((item) => item.unread).length
      },
      temperatureSeries: emptyHome ? [] : buildTemperatureSeries(deviceTelemetry),
      activitySeries: emptyHome ? [] : buildActivitySeries(notifications),
      currentScenario: scenarios.find((scenario) => scenario.active) ?? null,
      subscription,
      backendStatus: this.collector.getStatus()
    };
  }

  private async requirePremium(userId: string) {
    const subscription = await this.home.getSubscription(userId);
    if (!subscription.isPremium) {
      throw new Error("Функция доступна только по подписке SmartHome Premium");
    }
    return subscription;
  }

  private async trySync(userId: string, fn: () => Promise<void>, fallbackNotification: string) {
    try {
      await fn();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown sync error";
      await this.home.createNotification(userId, `${fallbackNotification}: ${detail}`, "system", true);
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

function renderReportPdf(report: ReportSummary): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({ margin: 0, size: "A4" });
    const fonts = setupReportFonts(document);

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    paintReportPage(document, fonts);

    let cursorY = drawReportHero(document, fonts, report);
    cursorY = drawMetricGrid(document, fonts, report, cursorY + 18);
    cursorY = drawSummaryCard(document, fonts, report, cursorY + 18);
    cursorY = drawTemperatureChart(document, fonts, report, cursorY + 18);

    cursorY = ensureReportSpace(document, fonts, cursorY + 18, 210);
    cursorY = drawDeviceActivity(document, fonts, report, cursorY);

    cursorY = ensureReportSpace(document, fonts, cursorY + 18, 230);
    drawScenarioAndNotificationBlocks(document, fonts, report, cursorY);

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
  const regularPath = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf"
  ].find((item) => fs.existsSync(item));
  const boldPath = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
  ].find((item) => fs.existsSync(item));

  if (regularPath) {
    document.registerFont("ReportRegular", regularPath);
  }
  if (boldPath) {
    document.registerFont("ReportBold", boldPath);
  }

  return {
    regular: regularPath ? "ReportRegular" : "Helvetica",
    bold: boldPath ? "ReportBold" : "Helvetica-Bold"
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

function drawReportHero(document: PdfDocument, fonts: ReportFonts, report: ReportSummary) {
  const x = 40;
  const y = 38;
  const width = document.page.width - 80;
  const height = 116;

  roundedCard(document, x, y, width, height, reportColors.cardSoft);
  document.roundedRect(x + 22, y + 24, 44, 44, 16).fill(reportColors.violetDark);
  document.font(fonts.bold).fontSize(22).fillColor(reportColors.text).text("SmartHome", x + 82, y + 25);
  document.font(fonts.regular).fontSize(12).fillColor(reportColors.muted).text("Premium Home Insights", x + 82, y + 55);
  document.font(fonts.regular).fontSize(10).fillColor(reportColors.subtle).text(`Сформировано: ${formatDateTime(report.generatedAt)}`, x + 82, y + 78);

  drawBadge(document, fonts, x + width - 152, y + 26, report.range === "7d" ? "7 дней" : "30 дней", reportColors.violetDark, reportColors.text);
  drawBadge(document, fonts, x + width - 152, y + 63, "PDF отчет", "#10231D", reportColors.emerald);

  document.font(fonts.bold).fontSize(24).fillColor(reportColors.text).text("⌁", x + 35, y + 32, { width: 18, align: "center" });
  return y + height;
}

function drawMetricGrid(document: PdfDocument, fonts: ReportFonts, report: ReportSummary, y: number) {
  const left = 40;
  const gap = 10;
  const width = (document.page.width - 80 - gap * 3) / 4;
  const averageTemp = average(report.temperatureSeries.map((item) => item.value));
  const onlineDevices = report.deviceActivity.filter((device) => device.online).length;
  const activeScenarios = report.scenarioActivity.filter((scenario) => scenario.active).length;
  const notificationCount = report.notificationStats.reduce((sum, item) => sum + item.count, 0);
  const cards = [
    { title: "Температура", value: averageTemp === null ? "—" : `${Math.round(averageTemp)}°C`, subtitle: "среднее значение", accent: reportColors.emerald },
    { title: "Устройства", value: `${onlineDevices}/${report.deviceActivity.length}`, subtitle: "на связи", accent: reportColors.violet },
    { title: "Сценарии", value: String(activeScenarios), subtitle: "активных правил", accent: reportColors.amber },
    { title: "Уведомления", value: String(notificationCount), subtitle: "за период", accent: reportColors.red }
  ];

  cards.forEach((card, index) => drawMetricCard(document, fonts, left + index * (width + gap), y, width, card));
  return y + 84;
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

function drawSummaryCard(document: PdfDocument, fonts: ReportFonts, report: ReportSummary, y: number) {
  const x = 40;
  const width = document.page.width - 80;
  roundedCard(document, x, y, width, 76, reportColors.card);
  document.font(fonts.bold).fontSize(13).fillColor(reportColors.text).text("Сводка по дому", x + 18, y + 16);
  document.font(fonts.regular).fontSize(10).fillColor(reportColors.muted).text(report.summary, x + 18, y + 39, { width: width - 36, lineGap: 3 });
  return y + 76;
}

function drawTemperatureChart(document: PdfDocument, fonts: ReportFonts, report: ReportSummary, y: number) {
  const x = 40;
  const width = document.page.width - 80;
  const height = 184;
  roundedCard(document, x, y, width, height, reportColors.card);
  document.font(fonts.bold).fontSize(13).fillColor(reportColors.text).text("Динамика температуры", x + 18, y + 16);
  document.font(fonts.regular).fontSize(9).fillColor(reportColors.subtle).text("Последние точки телеметрии за выбранный период", x + 18, y + 36);

  const chartX = x + 42;
  const chartY = y + 68;
  const chartWidth = width - 72;
  const chartHeight = 82;
  drawLineChart(document, fonts, report.temperatureSeries.slice(-12), chartX, chartY, chartWidth, chartHeight);
  return y + height;
}

function drawLineChart(document: PdfDocument, fonts: ReportFonts, points: Array<{ time: string; value: number }>, x: number, y: number, width: number, height: number) {
  for (let index = 0; index <= 3; index += 1) {
    const lineY = y + (height / 3) * index;
    document.moveTo(x, lineY).lineTo(x + width, lineY).lineWidth(0.6).strokeColor(reportColors.grid).stroke();
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
  document.lineWidth(2.5).strokeColor(reportColors.emerald).stroke();
  coords.forEach((coord) => document.circle(coord.x, coord.y, 3).fill(reportColors.emerald));

  document.font(fonts.regular).fontSize(8).fillColor(reportColors.subtle).text(`${max}°`, x - 30, y - 2, { width: 24, align: "right" });
  document.text(`${min}°`, x - 30, y + height - 8, { width: 24, align: "right" });
  document.text(points[0].time, x, y + height + 12, { width: 120 });
  document.text(points.at(-1)?.time ?? "", x + width - 120, y + height + 12, { width: 120, align: "right" });
}

function drawDeviceActivity(document: PdfDocument, fonts: ReportFonts, report: ReportSummary, y: number) {
  const x = 40;
  const width = document.page.width - 80;
  const rows = report.deviceActivity.slice(0, 7);
  const height = 54 + Math.max(rows.length, 1) * 26 + 18;
  roundedCard(document, x, y, width, height, reportColors.card);
  document.font(fonts.bold).fontSize(13).fillColor(reportColors.text).text("Устройства", x + 18, y + 16);
  document.font(fonts.regular).fontSize(9).fillColor(reportColors.subtle).text("Состояние и количество событий", x + 18, y + 36);

  if (rows.length === 0) {
    document.font(fonts.regular).fontSize(10).fillColor(reportColors.subtle).text("Устройства еще не добавлены", x + 18, y + 68);
    return y + height;
  }

  rows.forEach((device, index) => {
    const rowY = y + 62 + index * 26;
    document.font(fonts.regular).fontSize(9).fillColor(reportColors.text).text(device.name, x + 18, rowY, { width: 210, ellipsis: true });
    drawBadge(document, fonts, x + 248, rowY - 4, device.online ? "Online" : "Offline", device.online ? "#10231D" : "#2B171A", device.online ? reportColors.emerald : reportColors.red);
    drawBadge(document, fonts, x + 322, rowY - 4, device.enabled ? "Включено" : "Выключено", device.enabled ? reportColors.violetDark : "#27272A", device.enabled ? reportColors.text : reportColors.muted);
    document.font(fonts.bold).fontSize(9).fillColor(reportColors.muted).text(`${device.events} событий`, x + width - 104, rowY, { width: 86, align: "right" });
  });

  return y + height;
}

function drawScenarioAndNotificationBlocks(document: PdfDocument, fonts: ReportFonts, report: ReportSummary, y: number) {
  const x = 40;
  const gap = 14;
  const width = (document.page.width - 80 - gap) / 2;
  const scenarioRows = report.scenarioActivity.slice(0, 6);
  const notificationRows = report.notificationStats.slice(0, 6);
  const height = 224;

  roundedCard(document, x, y, width, height, reportColors.card);
  document.font(fonts.bold).fontSize(13).fillColor(reportColors.text).text("Сценарии", x + 16, y + 16);
  if (scenarioRows.length === 0) {
    document.font(fonts.regular).fontSize(10).fillColor(reportColors.subtle).text("Сценарии еще не созданы", x + 16, y + 56, { width: width - 32 });
  }
  scenarioRows.forEach((scenario, index) => {
    const rowY = y + 50 + index * 26;
    document.font(fonts.regular).fontSize(9).fillColor(reportColors.text).text(scenario.title, x + 16, rowY, { width: width - 108, ellipsis: true });
    drawBadge(document, fonts, x + width - 88, rowY - 4, scenario.active ? "Активен" : "Выкл.", scenario.active ? "#10231D" : "#27272A", scenario.active ? reportColors.emerald : reportColors.muted);
  });

  const nx = x + width + gap;
  roundedCard(document, nx, y, width, height, reportColors.card);
  document.font(fonts.bold).fontSize(13).fillColor(reportColors.text).text("Уведомления", nx + 16, y + 16);
  const maxCount = Math.max(...notificationRows.map((item) => item.count), 1);
  if (notificationRows.length === 0) {
    document.font(fonts.regular).fontSize(10).fillColor(reportColors.subtle).text("Уведомлений за период нет", nx + 16, y + 56, { width: width - 32 });
  }
  notificationRows.forEach((item, index) => {
    const rowY = y + 52 + index * 27;
    const barWidth = Math.max(8, ((width - 118) * item.count) / maxCount);
    document.font(fonts.regular).fontSize(9).fillColor(reportColors.text).text(notificationLabel(item.type), nx + 16, rowY, { width: 80, ellipsis: true });
    document.roundedRect(nx + 104, rowY + 2, width - 136, 8, 4).fill("#27272A");
    document.roundedRect(nx + 104, rowY + 2, barWidth, 8, 4).fill(reportColors.violet);
    document.font(fonts.bold).fontSize(9).fillColor(reportColors.muted).text(String(item.count), nx + width - 28, rowY - 1, { width: 14, align: "right" });
  });
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
