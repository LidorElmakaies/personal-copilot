# Observability stack

OTel Collector -> fans out to Loki (logs), Prometheus (metrics), Tempo (traces) -> all viewable in
Grafana. Every backend app (`gateway`, `users`) sends
telemetry here via `backend/libs/otel`.

```bash
docker compose up -d      # or: make up (same thing, nicer aliases — see Makefile)
```

Grafana: http://localhost:3001 (admin/admin — change this if this stack is ever exposed beyond
your Tailnet; root CLAUDE.md's Observability section says why it's published). No dashboards are
provisioned yet — `grafana/provisioning/dashboards/json/` is where they go; see
`.claude/agents/devops.md`'s "Grafana dashboards" section for the pattern to follow (one dashboard
per service, verified against real running-stack data before it's considered done — not screenshots
of a plausible-looking panel).

Must be started before `devops/`'s backend profile (`docker compose --profile backend up`), whose
services join this stack's `observability` Docker network (declared `external: true`); `apk` alone
doesn't need it — see root CLAUDE.md's "First run".
