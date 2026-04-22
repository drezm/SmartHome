import { Router } from "express";
import { z } from "zod";
import type { DeviceCategory, DeviceType, QuickActionKind, ScenarioCommand, ScenarioMetric, ScenarioOperator } from "../domain/types.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";
import type { AuthService } from "../services/authService.js";
import type { HomeService } from "../services/homeService.js";

const deviceTypeSchema = z.enum(["MOTION_SENSOR", "TEMPERATURE_SENSOR", "LIGHT_SENSOR", "CLIMATE_SENSOR", "SWITCH_SENSOR"]) satisfies z.ZodType<DeviceType>;
const deviceCategorySchema = z.enum(["Освещение", "Климат", "Розетки", "Безопасность", "Датчики", "Другое"]) satisfies z.ZodType<DeviceCategory>;
const scenarioMetricSchema = z.enum(["Температура", "Влажность", "Движение", "Освещенность", "CO2", "Выключатель"]) satisfies z.ZodType<ScenarioMetric>;
const scenarioOperatorSchema = z.enum([">", "<", "="]) satisfies z.ZodType<ScenarioOperator>;
const scenarioCommandSchema = z.enum(["Включить", "Выключить", "Инвертировать", "Установить значение"]) satisfies z.ZodType<ScenarioCommand>;
const quickActionSchema = z.enum(["TURN_ON_LIGHTS", "TURN_OFF_ALL", "NIGHT_MODE", "MORNING_MODE"]) satisfies z.ZodType<QuickActionKind>;
const cardholderPattern = /^[A-Za-zА-Яа-яЁё\s'-]{2,120}$/u;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function isLuhnValid(value: string) {
  let sum = 0;
  let shouldDouble = false;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return value.length > 0 && sum % 10 === 0;
}

function parseExpiry(value: string) {
  const match = value.trim().match(/^(\d{2})\/?(\d{2}|\d{4})$/);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const rawYear = match[2];
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);

  if (month < 1 || month > 12) {
    return null;
  }

  return { month, year };
}

function isExpiryValid(value: string) {
  const expiry = parseExpiry(value);
  if (!expiry) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (expiry.year > currentYear + 20) {
    return false;
  }

  return expiry.year > currentYear || (expiry.year === currentYear && expiry.month >= currentMonth);
}

const createDeviceSchema = z.object({
  name: z.string().min(2).max(120),
  type: deviceTypeSchema,
  category: deviceCategorySchema,
  room: z.string().min(2).max(80),
  enabled: z.boolean().optional()
});

const updateDeviceSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: deviceCategorySchema.optional(),
  room: z.string().min(2).max(80).optional(),
  online: z.boolean().optional(),
  enabled: z.boolean().optional(),
  metric: z.string().nullable().optional()
});

const createScenarioSchema = z.object({
  title: z.string().min(2).max(120),
  metric: scenarioMetricSchema,
  operator: scenarioOperatorSchema,
  value: z.coerce.number(),
  unit: z.string().nullable().optional(),
  targetDeviceId: z.string().nullable().optional(),
  targetDeviceName: z.string().min(2).max(120),
  command: scenarioCommandSchema,
  active: z.boolean().optional()
});

const updateScenarioSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  metric: scenarioMetricSchema.optional(),
  operator: scenarioOperatorSchema.optional(),
  value: z.coerce.number().optional(),
  unit: z.string().nullable().optional(),
  targetDeviceId: z.string().nullable().optional(),
  targetDeviceName: z.string().min(2).max(120).optional(),
  command: scenarioCommandSchema.optional(),
  active: z.boolean().optional()
});

const telemetrySchema = z.object({
  kind: z.string().min(2).max(40),
  value: z.coerce.number(),
  unit: z.string().nullable().optional()
});

const quickActionBodySchema = z.object({
  action: quickActionSchema
});

const checkoutSchema = z.object({
  cardholderName: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .refine((value) => cardholderPattern.test(value) && /[A-Za-zА-Яа-яЁё]/u.test(value), "Введите корректное имя держателя карты"),
  cardNumber: z
    .string()
    .transform(digitsOnly)
    .refine((value) => value.length >= 13 && value.length <= 19 && isLuhnValid(value), "Введите корректный номер карты"),
  expires: z.string().trim().refine(isExpiryValid, "Введите актуальный срок действия карты"),
  cvc: z
    .string()
    .transform(digitsOnly)
    .refine((value) => /^\d{3,4}$/.test(value), "Введите корректный CVC"),
  paymentEmail: z.string().trim().email()
});

const telegramSchema = z.object({
  botToken: z.string().min(10).max(240),
  chatId: z.string().min(3).max(80)
});

const reportRangeSchema = z.enum(["7d", "30d"]);

export function homeRoutes(auth: AuthService, home: HomeService) {
  const router = Router();
  router.use(authMiddleware(auth));

  router.get(
    "/dashboard",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json(await home.getDashboard(request.user.id));
    })
  );

  router.get(
    "/subscription",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json({ subscription: await home.getSubscription(request.user.id) });
    })
  );

  router.post(
    "/subscription/checkout",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const input = checkoutSchema.parse(request.body);
      response.json({ subscription: await home.checkoutSubscription(request.user.id, input) });
    })
  );

  router.post(
    "/subscription/cancel",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json({ subscription: await home.cancelSubscription(request.user.id) });
    })
  );

  router.get(
    "/integrations/telegram",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json({ telegram: await home.getTelegramIntegration(request.user.id) });
    })
  );

  router.put(
    "/integrations/telegram",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const input = telegramSchema.parse(request.body);
      response.json({ telegram: await home.updateTelegramIntegration(request.user.id, input) });
    })
  );

  router.post(
    "/integrations/telegram/test",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json(await home.sendTelegramTest(request.user.id));
    })
  );

  router.delete(
    "/integrations/telegram",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json({ telegram: await home.deleteTelegramIntegration(request.user.id) });
    })
  );

  router.get(
    "/reports/summary",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const range = reportRangeSchema.parse(request.query.range ?? "7d");
      response.json({ report: await home.getReportSummary(request.user.id, range) });
    })
  );

  router.get(
    "/reports/summary.pdf",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const range = reportRangeSchema.parse(request.query.range ?? "7d");
      const pdf = await home.getReportPdf(request.user.id, range);
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Disposition", `attachment; filename="smart-home-report-${range}.pdf"`);
      response.send(pdf);
    })
  );

  router.get(
    "/news/it",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json({ news: await home.listNews(request.user.id) });
    })
  );

  router.get(
    "/devices",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json({ devices: await home.listDevices(request.user.id) });
    })
  );

  router.post(
    "/devices",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const input = createDeviceSchema.parse(request.body);
      response.status(201).json({ device: await home.createDevice(request.user.id, input) });
    })
  );

  router.patch(
    "/devices/:id",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const input = updateDeviceSchema.parse(request.body);
      const device = await home.updateDevice(request.user.id, String(request.params.id), input);
      if (!device) {
        response.status(404).json({ message: "Устройство не найдено" });
        return;
      }

      response.json({ device });
    })
  );

  router.delete(
    "/devices/:id",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const device = await home.deleteDevice(request.user.id, String(request.params.id));
      if (!device) {
        response.status(404).json({ message: "Устройство не найдено" });
        return;
      }

      response.json({ device });
    })
  );

  router.get(
    "/scenarios",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json({ scenarios: await home.listScenarios(request.user.id) });
    })
  );

  router.post(
    "/scenarios",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const input = createScenarioSchema.parse(request.body);
      response.status(201).json({ scenario: await home.createScenario(request.user.id, { ...input, unit: input.unit ?? null, targetDeviceId: input.targetDeviceId ?? null }) });
    })
  );

  router.patch(
    "/scenarios/:id",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const input = updateScenarioSchema.parse(request.body);
      const scenario = await home.updateScenario(request.user.id, String(request.params.id), { ...input, unit: input.unit === undefined ? undefined : input.unit, targetDeviceId: input.targetDeviceId === undefined ? undefined : input.targetDeviceId });
      if (!scenario) {
        response.status(404).json({ message: "Сценарий не найден" });
        return;
      }

      response.json({ scenario });
    })
  );

  router.delete(
    "/scenarios/:id",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const scenario = await home.deleteScenario(request.user.id, String(request.params.id));
      if (!scenario) {
        response.status(404).json({ message: "Сценарий не найден" });
        return;
      }

      response.json({ scenario });
    })
  );

  router.get(
    "/telemetry",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json({ telemetry: await home.listTelemetry(request.user.id) });
    })
  );

  router.post(
    "/devices/:id/telemetry",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const input = telemetrySchema.parse(request.body);
      const telemetry = await home.addTelemetry(request.user.id, String(request.params.id), { ...input, unit: input.unit ?? null });
      if (!telemetry) {
        response.status(404).json({ message: "Устройство не найдено" });
        return;
      }

      response.status(201).json({ telemetry });
    })
  );

  router.get(
    "/notifications",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      response.json({ notifications: await home.listNotifications(request.user.id) });
    })
  );

  router.patch(
    "/notifications/:id/read",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const notification = await home.markNotificationRead(request.user.id, String(request.params.id));
      if (!notification) {
        response.status(404).json({ message: "Уведомление не найдено" });
        return;
      }

      response.json({ notification });
    })
  );

  router.post(
    "/quick-actions",
    asyncHandler<AuthenticatedRequest>(async (request, response) => {
      const { action } = quickActionBodySchema.parse(request.body);
      response.json({ devices: await home.applyQuickAction(request.user.id, action) });
    })
  );

  return router;
}
