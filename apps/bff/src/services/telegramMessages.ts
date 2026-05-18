import type { Device, ReportPayload, Scenario, Subscription } from "../domain/types.js";
import { formatRangeLabel } from "../domain/dateRange.js";

const SIGNATURE = "Команда SmartHome";

export function scenarioCreatedMessage(scenario: Scenario) {
  return lines(
    "Создан сценарий",
    `Название: ${scenario.title}`,
    `Условие: ${scenario.condition}`,
    `Действие: ${scenario.action}`,
    `Статус: ${scenario.active ? "активен" : "выключен"}`
  );
}

export function scenarioUpdatedMessage(scenario: Scenario) {
  return lines(
    "Сценарий обновлен",
    `Название: ${scenario.title}`,
    `Условие: ${scenario.condition}`,
    `Действие: ${scenario.action}`,
    `Статус: ${scenario.active ? "активен" : "выключен"}`
  );
}

export function automaticScenarioAppliedMessage(scenario: Scenario, target: Device, desiredEnabled: boolean) {
  return lines(
    "Автоматический сценарий выполнен",
    `Сценарий: ${scenario.title}`,
    `Устройство: ${target.name}`,
    `Результат: ${desiredEnabled ? "включено" : "выключено"}`,
    `Проверка: ${scenario.condition}`
  );
}

export function manualScenarioRunMessage(scenario: Scenario, changed: number) {
  return lines(
    "Ручной режим запущен",
    `Сценарий: ${scenario.title}`,
    `Изменено устройств: ${changed}`,
    `Действия: ${scenario.action}`
  );
}

export function deviceStateChangedMessage(device: Device) {
  return lines(
    "Состояние устройства изменено",
    `Устройство: ${device.name}`,
    `Состояние: ${device.enabled ? "включено" : "выключено"}`,
    `Комната: ${device.room}`
  );
}

export function telemetryChangedMessage(device: Device, previousMetric: string | null, nextMetric: string) {
  return lines(
    "Получены новые данные",
    `Источник: ${device.name}`,
    `Было: ${previousMetric ?? "нет данных"}`,
    `Стало: ${nextMetric}`
  );
}

export function subscriptionActivatedMessage(subscription: Subscription) {
  return lines(
    "Подписка SmartHome Premium активирована",
    `Доступ открыт до: ${subscription.expiresAt ? formatDate(subscription.expiresAt) : "без даты окончания"}`,
    "Открыты дополнительные отчеты и PDF-экспорт."
  );
}

export function subscriptionCancelledMessage(subscription: Subscription) {
  return lines(
    "Автопродление SmartHome Premium отключено",
    `Доступ сохранится до: ${subscription.expiresAt ? formatDate(subscription.expiresAt) : "даты окончания подписки"}`,
    "После этого аккаунт вернется на бесплатный тариф."
  );
}

export function reportGeneratedMessage(report: ReportPayload) {
  return lines(
    "Сформирован отчет",
    `Название: ${report.title}`,
    `Период: ${formatRangeLabel(report.range)}`,
    `Сводка: ${report.summary}`
  );
}

export function telegramConnectedTestMessage() {
  return lines(
    "Telegram-интеграция подключена",
    "Тестовое сообщение доставлено успешно.",
    "Теперь важные события дома будут приходить сюда."
  );
}

function lines(title: string, ...body: string[]) {
  return [title, ...body, `Время: ${formatDateTime(new Date().toISOString())}`, SIGNATURE].join("\n");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
