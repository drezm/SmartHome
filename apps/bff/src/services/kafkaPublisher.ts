import { Kafka, type Producer } from "kafkajs";
import { env } from "../config/env.js";
import type { WeatherSnapshot } from "../domain/types.js";

type WeatherReadingEvent = {
  userId: string;
  observedAt: string;
  updatedAt: string;
  locationLabel: string | null;
  snapshot: WeatherSnapshot;
  readings: Array<{
    deviceId: string;
    kind: string;
    value: number;
    unit: string | null;
  }>;
};

class KafkaWeatherPublisher {
  private producer: Promise<Producer | null> | null = null;

  async publishWeather(event: WeatherReadingEvent) {
    if (!env.KAFKA_ENABLED) {
      return;
    }

    try {
      const producer = await this.getProducer();
      if (!producer) {
        return;
      }

      await producer.send({
        topic: env.KAFKA_WEATHER_TOPIC,
        messages: [
          {
            key: event.userId,
            value: JSON.stringify({
              type: "open_meteo.weather",
              version: 1,
              ...event
            })
          }
        ]
      });
    } catch (error) {
      console.warn("Kafka weather publish failed", error);
    }
  }

  private async getProducer() {
    this.producer ??= this.connectProducer();
    return this.producer;
  }

  private async connectProducer() {
    const brokers = env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean);
    if (brokers.length === 0) {
      return null;
    }

    const kafka = new Kafka({ clientId: "smart-home-bff", brokers });
    const producer = kafka.producer();
    await producer.connect();
    return producer;
  }
}

export const kafkaWeatherPublisher = new KafkaWeatherPublisher();
