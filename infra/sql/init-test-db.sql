-- Enable TimescaleDB if available (safe with our image)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Metric readings hypertable
CREATE TABLE IF NOT EXISTS metric_readings (
  device_id UUID NOT NULL,
  metric_name TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  value DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('metric_readings', 'ts', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_metric_readings_device_metric_ts_desc
  ON metric_readings (device_id, metric_name, ts DESC);

CREATE INDEX IF NOT EXISTS idx_metric_readings_ts_desc
  ON metric_readings (ts DESC);

-- Rules table
CREATE TABLE IF NOT EXISTS rules (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL,
  metric_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  min_value DOUBLE PRECISION NULL,
  max_value DOUBLE PRECISION NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL,
  metric_name TEXT NOT NULL,
  rule_id UUID NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_status_triggered_at
  ON alerts (status, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_device_metric_triggered_at
  ON alerts (device_id, metric_name, triggered_at DESC);
