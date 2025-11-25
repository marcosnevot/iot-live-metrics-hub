import { Injectable } from "@nestjs/common";
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";

/**
 * ObservabilityService owns the Prometheus registry and all internal metrics.
 * Other modules can inject this service to increment counters or record latencies.
 */
@Injectable()
export class ObservabilityService {
  private readonly registry: Registry;

  private readonly httpRequestsTotal: Counter<string>;
  private readonly ingestTotal: Counter<string>;
  private readonly alertsTriggeredTotal: Counter<string>;
  private readonly processingLatencyMs: Histogram<string>;
  private readonly dbWriteLatencyMs: Histogram<string>;

  constructor() {
    this.registry = new Registry();

    // Collect default Node.js process metrics (CPU, memory, event loop lag, etc.)
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests received by the backend.",
      labelNames: ["method", "path", "status_code"],
      registers: [this.registry],
    });

    this.ingestTotal = new Counter({
      name: "iot_ingest_total",
      help: "Total number of ingest operations.",
      labelNames: ["channel", "result"],
      registers: [this.registry],
    });

    this.alertsTriggeredTotal = new Counter({
      name: "iot_alerts_triggered_total",
      help: "Total number of alerts triggered by the rules engine.",
      labelNames: ["device_id", "metric_name", "rule_type"],
      registers: [this.registry],
    });

    this.processingLatencyMs = new Histogram({
      name: "iot_processing_latency_ms",
      help: "Processing latency in milliseconds for the ingest pipeline.",
      labelNames: ["stage"],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    this.dbWriteLatencyMs = new Histogram({
      name: "iot_db_write_latency_ms",
      help: "Database write latency in milliseconds for time-series writes.",
      labelNames: ["operation"],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });
  }

  /**
   * Expose the registry so that advanced scenarios can register extra collectors if needed.
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Returns the metrics payload in Prometheus text exposition format.
   */
  async getMetricsAsText(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * HTTP metrics
   */
  incrementHttpRequest(method: string, path: string, statusCode: number): void {
    const normalizedPath = (path || "unknown").toLowerCase();

    this.httpRequestsTotal.inc({
      method: method.toUpperCase(),
      path: normalizedPath,
      status_code: String(statusCode),
    });
  }

  /**
   * Ingest metrics
   */
  incrementIngestTotal(
    channel: "http" | "mqtt",
    result: "success" | "error",
  ): void {
    this.ingestTotal.inc({ channel, result });
  }

  /**
   * Alerts metrics
   */
  incrementAlertTriggered(
    deviceId: string,
    metricName: string,
    ruleType: string,
  ): void {
    this.alertsTriggeredTotal.inc({
      device_id: deviceId,
      metric_name: metricName,
      rule_type: ruleType,
    });
  }

  /**
   * Latency metrics
   */
  observeProcessingLatency(stage: string, millis: number): void {
    if (millis < 0) {
      return;
    }
    this.processingLatencyMs.observe({ stage }, millis);
  }

  observeDbWriteLatency(operation: string, millis: number): void {
    if (millis < 0) {
      return;
    }
    this.dbWriteLatencyMs.observe({ operation }, millis);
  }
}
