# Every backend app's environment

Variables the shared libs in `backend/libs/` read, the same in every backend app that uses them.
Each app's own variables are on its page: [gateway](../gateway/environment.md),
[users](../users/environment.md), [reminders](../reminders/environment.md),
[notifications](../notifications/environment.md).

- **`OTEL_EXPORTER_OTLP_ENDPOINT`** — where `@app/otel` sends traces, metrics and logs. Defaults to
  the Docker network's collector (`http://otel-collector:4317`); a local (non-Docker) run needs
  `http://localhost:4317`, or export fails silently.
- **`OTEL_SERVICE_NAME`** — set per app in its `devops/<app>/docker-compose.yml`. When set, the OTel
  SDK exports it as `service.name` in place of `main.ts`'s `startOtel('<app>')`, so keep the two
  equal.
