import { MqttIngestListener } from "./mqtt-ingest.listener";

describe("MqttIngestListener", () => {
  const deviceId = "550e8400-e29b-41d4-a716-446655440000";

  const buildListener = () => {
    const ingestService = {
      ingest: jest.fn().mockResolvedValue(1),
    };

    const listener = new MqttIngestListener(ingestService as any);

    return {
      listener,
      ingestService,
    };
  };

  it("should call IngestService on valid MQTT message", async () => {
    const { listener, ingestService } = buildListener();

    const topic = `devices/${deviceId}/metrics`;
    const payload = Buffer.from(
      JSON.stringify({
        metrics: [
          {
            name: "temperature",
            value: 21.5,
            ts: "2025-11-24T10:00:00Z",
          },
        ],
      }),
    );

    await listener.handleMessage(topic, payload);

    expect(ingestService.ingest).toHaveBeenCalledTimes(1);
    expect(ingestService.ingest).toHaveBeenCalledWith(
      {
        device_id: deviceId,
        metrics: [
          {
            name: "temperature",
            value: 21.5,
            ts: "2025-11-24T10:00:00Z",
          },
        ],
      },
      {
        channel: "mqtt",
      },
    );
  });

  it("should ignore messages with invalid JSON", async () => {
    const { listener, ingestService } = buildListener();

    const topic = `devices/${deviceId}/metrics`;
    const payload = Buffer.from("this-is-not-json");

    await listener.handleMessage(topic, payload);

    expect(ingestService.ingest).not.toHaveBeenCalled();
  });

  it("should ignore messages with invalid topic", async () => {
    const { listener, ingestService } = buildListener();

    const topic = "invalid/topic";
    const payload = Buffer.from(
      JSON.stringify({
        metrics: [
          {
            name: "temperature",
            value: 21.5,
          },
        ],
      }),
    );

    await listener.handleMessage(topic, payload);

    expect(ingestService.ingest).not.toHaveBeenCalled();
  });

  it("should ignore messages with invalid metrics payload", async () => {
    const { listener, ingestService } = buildListener();

    const topic = `devices/${deviceId}/metrics`;
    const payload = Buffer.from(
      JSON.stringify({
        metrics: [
          {
            name: "temperature",
            value: "not-a-number",
          },
        ],
      }),
    );

    await listener.handleMessage(topic, payload);

    expect(ingestService.ingest).not.toHaveBeenCalled();
  });
});
