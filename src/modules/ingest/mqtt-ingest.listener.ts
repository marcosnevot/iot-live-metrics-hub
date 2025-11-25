import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { connect, MqttClient } from "mqtt";
import { IngestService } from "./ingest.service";
import { IngestRequestDto } from "./dto/ingest-request.dto";

type RawPayload = {
  metrics?: unknown;
};

type RawMetric = {
  [key: string]: unknown;
};

@Injectable()
export class MqttIngestListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttIngestListener.name);
  private client?: MqttClient;

  constructor(private readonly ingestService: IngestService) {}

  async onModuleInit(): Promise<void> {
    const envBrokerUrl = process.env.MQTT_BROKER_URL;

    this.logger.log({
      module: "mqtt_ingest",
      operation: "init",
      step: "read_env",
      brokerUrl: envBrokerUrl ?? "(not set)",
    });

    // Force IPv4 localhost for local dev to avoid any resolution issues
    const brokerUrl = envBrokerUrl || "mqtt://127.0.0.1:1883";

    this.logger.log({
      module: "mqtt_ingest",
      operation: "connect",
      brokerUrl,
      status: "connecting",
    });

    this.client = connect(brokerUrl, {
      reconnectPeriod: 5_000,
    });

    this.client.on("connect", () => {
      this.logger.log({
        module: "mqtt_ingest",
        operation: "connect",
        brokerUrl,
        status: "connected",
      });

      const topic = "devices/+/metrics";

      this.client?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          this.logger.error({
            module: "mqtt_ingest",
            operation: "subscribe",
            topic,
            status: "error",
            reason: (err as Error).message,
          });
          return;
        }

        this.logger.log({
          module: "mqtt_ingest",
          operation: "subscribe",
          topic,
          status: "subscribed",
        });
      });
    });

    this.client.on("reconnect", () => {
      this.logger.warn({
        module: "mqtt_ingest",
        operation: "lifecycle",
        event: "reconnect",
      });
    });

    this.client.on("close", () => {
      this.logger.warn({
        module: "mqtt_ingest",
        operation: "lifecycle",
        event: "close",
      });
    });

    this.client.on("offline", () => {
      this.logger.warn({
        module: "mqtt_ingest",
        operation: "lifecycle",
        event: "offline",
      });
    });

    this.client.on("error", (err) => {
      this.logger.error({
        module: "mqtt_ingest",
        operation: "client_error",
        error: (err as Error).message,
      });
    });

    this.client.on("message", (topic, payload) => {
      // Fire-and-forget async handler to avoid blocking the MQTT client loop
      void this.handleMessage(topic, payload);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.client.connected) {
      this.logger.log({
        module: "mqtt_ingest",
        operation: "shutdown",
        status: "closing_connection",
      });

      await new Promise<void>((resolve) => {
        this.client?.end(false, {}, () => resolve());
      });

      this.logger.log({
        module: "mqtt_ingest",
        operation: "shutdown",
        status: "connection_closed",
      });
    }
  }

  /**
   * Internal handler for MQTT messages.
   * This method is public to make it easier to test in isolation.
   */
  async handleMessage(topic: string, payload: Buffer): Promise<void> {
    const payloadString = payload.toString();

    this.logger.debug({
      module: "mqtt_ingest",
      operation: "message_received",
      topic,
      payload: payloadString,
    });

    const topicParts = topic.split("/");

    if (
      topicParts.length !== 3 ||
      topicParts[0] !== "devices" ||
      topicParts[2] !== "metrics"
    ) {
      this.logger.warn({
        module: "mqtt_ingest",
        operation: "message_received",
        event: "unexpected_topic",
        topic,
      });
      return;
    }

    const deviceId = topicParts[1];

    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadString);
    } catch (error) {
      this.logger.warn({
        module: "mqtt_ingest",
        operation: "parse_payload",
        topic,
        deviceId,
        status: "error",
        reason: (error as Error).message,
      });
      return;
    }

    const data = parsed as RawPayload;

    if (!Array.isArray(data.metrics) || data.metrics.length === 0) {
      this.logger.warn({
        module: "mqtt_ingest",
        operation: "validate_payload",
        topic,
        deviceId,
        status: "error",
        reason: "metrics field must be a non-empty array",
      });
      return;
    }

    const normalizedMetrics: { name: string; value: number; ts?: string }[] =
      [];

    for (const candidate of data.metrics) {
      if (!this.isValidMetric(candidate)) {
        this.logger.warn({
          module: "mqtt_ingest",
          operation: "validate_metric",
          topic,
          deviceId,
          status: "error",
          invalidMetric: candidate,
        });
        return;
      }

      normalizedMetrics.push({
        name: candidate.name,
        value: candidate.value,
        ts: candidate.ts,
      });
    }

    const ingestRequest: IngestRequestDto = {
      device_id: deviceId,
      metrics: normalizedMetrics,
    };

    try {
      const stored = await this.ingestService.ingest(ingestRequest, {
        channel: "mqtt",
      });

      this.logger.log({
        module: "mqtt_ingest",
        operation: "ingest",
        deviceId,
        metricsCount: stored,
        status: "success",
      });
    } catch (error) {
      this.logger.error({
        module: "mqtt_ingest",
        operation: "ingest",
        deviceId,
        status: "error",
        reason: (error as Error).message,
      });
    }
  }

  private isValidMetric(candidate: unknown): candidate is {
    name: string;
    value: number;
    ts?: string;
  } {
    if (typeof candidate !== "object" || candidate === null) {
      return false;
    }

    const metric = candidate as RawMetric;

    if (typeof metric.name !== "string") {
      return false;
    }

    if (typeof metric.value !== "number" || Number.isNaN(metric.value)) {
      return false;
    }

    if (metric.ts !== undefined && typeof metric.ts !== "string") {
      return false;
    }

    return true;
  }
}
