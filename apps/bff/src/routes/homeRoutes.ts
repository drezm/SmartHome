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
      const scenario = await home.updateScenario(request.user.id, String(request.params.id), input);
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
