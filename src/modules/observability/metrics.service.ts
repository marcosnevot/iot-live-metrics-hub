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

  constructor() {
    this.registry = new Registry();

    // Collect default Node.js process metrics (CPU, memory, event loop lag, etc.)
    collectDefaultMetrics({ register: this.registry });

    // HTTP-level metrics (suggested in F8 report)
    new Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests received by the backend.",
      labelNames: ["method", "path", "status_code"],
      registers: [this.registry],
    });

    // Ingest-related metrics (aligned with RF-20 / DEC-04 design)
    new Counter({
      name: "iot_ingest_total",
      help: "Total number of ingest operations.",
      labelNames: ["channel", "result"],
      registers: [this.registry],
    });

    new Counter({
      name: "iot_alerts_triggered_total",
      help: "Total number of alerts triggered by the rules engine.",
      labelNames: ["device_id", "metric_name", "rule_type"],
      registers: [this.registry],
    });

    new Histogram({
      name: "iot_processing_latency_ms",
      help: "Processing latency in milliseconds for the ingest pipeline.",
      labelNames: ["stage"],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    new Histogram({
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
}
