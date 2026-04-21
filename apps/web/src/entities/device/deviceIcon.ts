import { Cpu, Fan, Lightbulb, Plug, Shield, Thermometer, Wind, type LucideIcon } from "lucide-react";
import type { DeviceCategory, DeviceType } from "@/shared/api/types";

export const deviceTypeOptions: Array<{ type: DeviceType; category: DeviceCategory; label: string; icon: LucideIcon; subtitle: string }> = [
  { type: "LIGHT_SENSOR", category: "Освещение", label: "Освещение", icon: Lightbulb, subtitle: "Лампы, светильники" },
  { type: "CLIMATE_SENSOR", category: "Климат", label: "Климат", icon: Wind, subtitle: "Кондиционеры, термостаты" },
  { type: "SWITCH_SENSOR", category: "Розетки", label: "Розетки", icon: Plug, subtitle: "Умные розетки" },
  { type: "MOTION_SENSOR", category: "Безопасность", label: "Безопасность", icon: Shield, subtitle: "Датчики движения" },
  { type: "TEMPERATURE_SENSOR", category: "Датчики", label: "Датчики", icon: Thermometer, subtitle: "Температура" },
  { type: "CLIMATE_SENSOR", category: "Другое", label: "Другое", icon: Cpu, subtitle: "Прочие устройства" }
];

export function getDeviceIcon(type: DeviceType, category?: DeviceCategory) {
  if (category === "Климат" && type === "CLIMATE_SENSOR") return Fan;
  return deviceTypeOptions.find((item) => item.type === type && (!category || item.category === category))?.icon ?? Cpu;
}
