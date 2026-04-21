import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { env } from "../../config/env.js";
import type { Device, Scenario } from "../../domain/types.js";

type GrpcCallback = (error: Error | null, response?: unknown) => void;
type CollectorControllerClient = {
  CollectHubEvent: (request: unknown, callback: GrpcCallback) => void;
  CollectSensorEvent: (request: unknown, callback: GrpcCallback) => void;
};

export class CollectorClient {
  private readonly client: CollectorControllerClient | null;
  private lastSyncError: string | null = null;
  private readonly enabled: boolean;

  constructor(private readonly collectorUrl = env.COLLECTOR_GRPC_URL) {
    this.enabled = !["disabled", "off", "none", ""].includes(collectorUrl.trim().toLowerCase());

    if (!this.enabled) {
      this.client = null;
      return;
    }

    const protoRoot = path.resolve(process.cwd(), "src/adapters/grpc/protos");
    const packageDefinition = protoLoader.loadSync(path.join(protoRoot, "telemetry/services/collector_controller.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [protoRoot]
    });

    const grpcObject = grpc.loadPackageDefinition(packageDefinition) as any;
    const Service = grpcObject.telemetry.service.collector.CollectorController;
    this.client = new Service(collectorUrl, grpc.credentials.createInsecure());
  }

  getStatus() {
    if (!this.enabled) {
      return {
        collectorUrl: "локальный режим",
        mode: "local" as const,
        lastSyncError: null
      };
    }

    return {
      collectorUrl: this.collectorUrl,
      mode: this.lastSyncError ? "degraded" as const : "connected" as const,
      lastSyncError: this.lastSyncError
    };
  }

  async sendDeviceAdded(device: Device) {
    await this.collectHubEvent({
      hub_id: env.HUB_ID,
      timestamp: timestamp(),
      device_added: {
        id: device.id,
        type: device.type
      }
    });
  }

  async sendDeviceRemoved(device: Device) {
    await this.collectHubEvent({
      hub_id: env.HUB_ID,
      timestamp: timestamp(),
      device_removed: {
        id: device.id
      }
    });
  }

  async sendScenarioAdded(scenario: Scenario) {
    await this.collectHubEvent({
      hub_id: env.HUB_ID,
      timestamp: timestamp(),
      scenario_added: {
        name: scenario.title,
        condition: [
          {
            sensor_id: scenario.targetDeviceId ?? "unknown",
            type: mapMetricToConditionType(scenario.metric),
            operation: mapOperator(scenario.operator),
            int_value: Math.round(scenario.value)
          }
        ],
        action: [
          {
            sensor_id: scenario.targetDeviceId ?? "unknown",
            type: mapCommand(scenario.command),
            value: scenario.command === "Установить значение" ? Math.round(scenario.value) : undefined
          }
        ]
      }
    });
  }

  async sendScenarioRemoved(scenario: Scenario) {
    await this.collectHubEvent({
      hub_id: env.HUB_ID,
      timestamp: timestamp(),
      scenario_removed: {
        name: scenario.title
      }
    });
  }

  async sendSwitchState(device: Device) {
    await this.collectSensorEvent({
      id: device.id,
      timestamp: timestamp(),
      hubId: env.HUB_ID,
      switch_sensor: {
        state: device.enabled
      }
    });
  }

  async sendTelemetry(device: Device, input: { kind: string; value: number }) {
    await this.collectSensorEvent({
      id: device.id,
      timestamp: timestamp(),
      hubId: env.HUB_ID,
      ...buildSensorPayload(device, input)
    });
  }

  private collectHubEvent(request: unknown) {
    return this.call("CollectHubEvent", request);
  }

  private collectSensorEvent(request: unknown) {
    return this.call("CollectSensorEvent", request);
  }

  private call(method: "CollectHubEvent" | "CollectSensorEvent", request: unknown) {
    if (!this.enabled || !this.client) {
      return Promise.resolve();
    }

    const client = this.client;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const error = new Error(`Collector не ответил по адресу ${this.collectorUrl}`);
        this.lastSyncError = error.message;
        reject(error);
      }, 2000);

      client[method](request, (error) => {
        clearTimeout(timeout);
        if (error) {
          const friendlyError = new Error(`Collector недоступен по адресу ${this.collectorUrl}`);
          this.lastSyncError = friendlyError.message;
          reject(friendlyError);
          return;
        }

        this.lastSyncError = null;
        resolve();
      });
    });
  }
}

export const collectorClient = new CollectorClient();

function timestamp() {
  const millis = Date.now();
  return {
    seconds: Math.floor(millis / 1000),
    nanos: (millis % 1000) * 1_000_000
  };
}

function mapMetricToConditionType(metric: Scenario["metric"]) {
  const dictionary: Record<Scenario["metric"], string> = {
    Температура: "TEMPERATURE",
    Влажность: "HUMIDITY",
    Движение: "MOTION",
    Освещенность: "LUMINOSITY",
    CO2: "CO2LEVEL",
    Выключатель: "SWITCH"
  };

  return dictionary[metric];
}

function mapOperator(operator: Scenario["operator"]) {
  if (operator === ">") return "GREATER_THAN";
  if (operator === "<") return "LOWER_THAN";
  return "EQUALS";
}

function mapCommand(command: Scenario["command"]) {
  const dictionary: Record<Scenario["command"], string> = {
    Включить: "ACTIVATE",
    Выключить: "DEACTIVATE",
    Инвертировать: "INVERSE",
    "Установить значение": "SET_VALUE"
  };

  return dictionary[command];
}

function buildSensorPayload(device: Device, input: { kind: string; value: number }) {
  if (device.type === "TEMPERATURE_SENSOR") {
    return {
      temperature_sensor: {
        temperature_c: Math.round(input.value),
        temperature_f: Math.round(input.value * 1.8 + 32)
      }
    };
  }

  if (device.type === "CLIMATE_SENSOR") {
    return {
      climate_sensor: {
        temperature_c: input.kind === "temperature" ? Math.round(input.value) : 22,
        humidity: input.kind === "humidity" ? Math.round(input.value) : 45,
        co2_level: input.kind === "co2" ? Math.round(input.value) : 420
      }
    };
  }

  if (device.type === "LIGHT_SENSOR") {
    return {
      light_sensor: {
        link_quality: 95,
        luminosity: Math.round(input.value)
      }
    };
  }

  if (device.type === "MOTION_SENSOR") {
    return {
      motion_sensor: {
        link_quality: 92,
        motion: input.value > 0,
        voltage: 230
      }
    };
  }

  return {
    switch_sensor: {
      state: input.value > 0
    }
  };
}
