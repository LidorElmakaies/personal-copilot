# Architecture

How the pieces in `docs/specs/services.md` fit together. This file is diagrams; see `services.md`
for the per-service contract and `event-schemas.md` for the (currently empty) Kafka contract.

## System topology

```mermaid
flowchart LR
    Phone(["Your phone"])

    subgraph Tailnet["Tailscale network"]
        Gateway["gateway\n:8000"]
        Frontend["frontend\n:8081"]
    end

    subgraph Docker["Docker network: shabbat-notifier"]
        Auth["auth"]
        Postgres[("postgres")]
        Kafka{{"kafka (idle)"}}
    end

    Phone -->|HTTPS + WS| Gateway
    Phone -->|HTTPS| Frontend
    Frontend -->|REST + WS| Gateway

    Gateway -->|HTTP| Auth
    Auth --> Postgres
```

Only `gateway` and `frontend` are reachable from outside the Docker network (over Tailscale).
`auth` is internal-only. `kafka` runs as generic plumbing — nothing produces or consumes yet.
Gateway's WS (`/ws`) authenticates connections and can push to a specific user
(`IRealtimeConnectionService.pushToUser`), but no feature sends anything over it yet either.

## Flow: register / login

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Gateway
    participant Auth as auth
    participant DB as Postgres

    User->>Frontend: submit email + password
    Frontend->>Gateway: POST /auth/login
    Gateway->>Auth: forward (HTTP)
    Auth->>DB: look up user, verify password hash
    Auth-->>Gateway: { access_token, refresh_token }
    Gateway-->>Frontend: relay verbatim
    Frontend->>Frontend: decode access_token → user
```
