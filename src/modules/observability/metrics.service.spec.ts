import { ObservabilityService } from "./metrics.service";

describe("ObservabilityService", () => {
  let service: ObservabilityService;

  beforeEach(() => {
    service = new ObservabilityService();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should expose registry with custom metrics registered", async () => {
    const text = await service.getMetricsAsText();

    expect(text).toContain("http_requests_total");
    expect(text).toContain("iot_ingest_total");
    expect(text).toContain("iot_alerts_triggered_total");
    expect(text).toContain("iot_processing_latency_ms");
    expect(text).toContain("iot_db_write_latency_ms");
  });

  it("should increment http request metric with normalized path and uppercased method", async () => {
    service.incrementHttpRequest("get", "/Devices", 200);

    const text = await service.getMetricsAsText();

    expect(text).toContain("http_requests_total");
    expect(text).toContain('method="GET"');
    expect(text).toContain('path="/devices"');
    expect(text).toContain('status_code="200"');
  });

  it("should increment ingest metric with channel and result labels", async () => {
    service.incrementIngestTotal("http", "success");

    const text = await service.getMetricsAsText();

    expect(text).toContain("iot_ingest_total");
    expect(text).toContain('channel="http"');
    expect(text).toContain('result="success"');
  });

  it("should increment alerts triggered metric with labels", async () => {
    service.incrementAlertTriggered("device-1", "temperature", "MAX");

    const text = await service.getMetricsAsText();

    expect(text).toContain("iot_alerts_triggered_total");
    expect(text).toContain('device_id="device-1"');
    expect(text).toContain('metric_name="temperature"');
    expect(text).toContain('rule_type="MAX"');
  });

  it("should record processing latency for non-negative values", async () => {
    service.observeProcessingLatency("ingest_pipeline", 42);

    const text = await service.getMetricsAsText();

    expect(text).toContain("iot_processing_latency_ms");
    expect(text).toContain('stage="ingest_pipeline"');
  });

  it("should ignore negative processing latency values", () => {
    expect(() =>
      service.observeProcessingLatency("ingest_pipeline", -5),
    ).not.toThrow();
  });

  it("should record db write latency for non-negative values", async () => {
    service.observeDbWriteLatency("insert", 12);

    const text = await service.getMetricsAsText();

    expect(text).toContain("iot_db_write_latency_ms");
    expect(text).toContain('operation="insert"');
  });

  it("should ignore negative db write latency values", () => {
    expect(() => service.observeDbWriteLatency("insert", -10)).not.toThrow();
  });
});
