# Observability stack

OTel Collector -> fans out to Loki (logs), Prometheus (metrics), Tempo (traces) -> all viewable in
Grafana. `gateway`/`auth` send real telemetry here via `backend/libs/otel`.

```bash
docker compose up -d      # or: make up (same thing, nicer aliases — see Makefile)
```

Grafana: http://localhost:3001 (admin/admin — change this if this stack is ever exposed beyond
your Tailnet, see docker-compose.yml's comment on the `grafana` service). No dashboards are
provisioned yet — `grafana/provisioning/dashboards/json/` is where they go; see
`.claude/agents/devops.md`'s "Grafana dashboard" section for the pattern to follow (one dashboard
per service, verified against real running-stack data before it's considered done — not screenshots
of a plausible-looking panel).

Must be started before `devops/`'s app stack (`devops/docker-compose.yml` references this stack's
`observability` Docker network as `external: true`) — see root CLAUDE.md's startup sequence.
