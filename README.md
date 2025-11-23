# IoT Live Metrics Hub

Backend platform for ingesting IoT sensor data, storing it as time-series,
evaluating alert rules in near real-time and exposing query APIs.

## Status

> Phase F1 – Repository setup (skeleton structure and minimal CI only).

## High-level features (v1.0 scope)

- HTTP + MQTT ingestion for IoT metrics.
- Time-series storage using PostgreSQL + TimescaleDB.
- Simple rules engine (min/max/range) with alert generation.
- REST APIs for devices, metrics and alerts.
- Basic security: API keys for devices, JWT for human users.
- Observability: structured JSON logs + Prometheus metrics.

## Getting started (development)

> NOTE: Actual setup instructions will be completed in later phases
> once the NestJS application and Docker environment are in place.

For now, you can clone the repository and run the linter and tests:

    npm install
    npm run lint
    npm test

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for technical details.

## Design references

This implementation follows the "Master Design Document – IoT Live Metrics Hub v1.0",
which defines requirements (RF/RNF), constraints and architectural decisions (DEC-01..DEC-09).
