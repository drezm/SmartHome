import { describe, expect, it } from "vitest";
import type { Device, Scenario } from "../domain/types.js";
import {
  automaticScenarioAppliedMessage,
  manualScenarioRunMessage,
  scenarioCreatedMessage,
  scenarioUpdatedMessage,
  telegramConnectedTestMessage
} from "../services/telegramMessages.js";

const device = {
  id: "device-1",
  name: "Кондиционер",
  type: "CLIMATE_SENSOR",
  category: "Климат",
  room: "Спальня",
  online: true,
  enabled: true,
  metric: null,
  sourceKind: "manual",
  sourceMetric: null,
  isSystem: false,
  lastSeen: "2026-05-15T10:00:00.000Z",
  createdAt: "2026-05-15T10:00:00.000Z"
} satisfies Device;

const scenario = {
  id: "scenario-1",
  title: "Автоохлаждение",
  triggerType: "automatic",
  automationSource: "sensor",
  favorite: false,
  metric: "Температура",
  operator: ">",
  value: 25,
  unit: "°C",
  sourceDeviceId: "sensor-1",
  sourceDeviceName: "Датчик температуры",
  sourceMetric: "temperature",
  scheduleTime: null,
  scheduleTimezone: null,
  lastScheduleRunAt: null,
  targetDeviceId: "device-1",
  targetDeviceName: "Кондиционер",
  command: "Включить",
  active: true,
  actions: [],
  lastEvaluation: {
    status: "matched",
    actualValue: 26,
    unit: "°C",
    reason: null,
    evaluatedAt: "2026-05-15T10:00:00.000Z",
    applied: true
  },
  condition: "Если датчик температуры: температура > 25°C",
  action: "Включить кондиционер",
  createdAt: "2026-05-15T10:00:00.000Z"
} satisfies Scenario;

describe("telegram messages", () => {
  it("formats key scenario messages with a signature", () => {
    for (const message of [
      scenarioCreatedMessage(scenario),
      scenarioUpdatedMessage(scenario),
      automaticScenarioAppliedMessage(scenario, device, true),
      manualScenarioRunMessage({ ...scenario, triggerType: "manual", action: "2 действия" }, 2),
      telegramConnectedTestMessage()
    ]) {
      expect(message).toContain("Команда SmartHome");
      expect(message.split("\n").length).toBeGreaterThan(2);
    }
  });
});
