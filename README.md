# personal-copilot

A personal NestJS + Expo app, self-hosted on a home PC and used from a phone over Tailscale.
Today it shows Shabbat times (candle lighting, Havdalah, countdown) for the phone's location on the
Home screen, with optional login. Per-user reminders and a Jewish-calendar tab are next — see
[the plan](docs/plans/shabbat-reminders-calendar/plan.md).

See [CLAUDE.md](CLAUDE.md) for architecture, setup, and how this repo is organized —
[docs/specs/](docs/specs/) for the service/event contracts. To start the stack, follow CLAUDE.md's
"First run": it needs both `devops/.env` and `backend/.env`, including `VAPID_*` keys (the stack
won't boot without them).

## Phone access (Tailscale HTTPS)

The app reaches your phone over [Tailscale](https://tailscale.com). It must be served over HTTPS,
because phone browsers only allow location (GPS) on HTTPS pages — the Shabbat times need it.

One-time setup on this PC:

```bash
curl -fsSL https://tailscale.com/install.sh | sh     # install
sudo tailscale up                                      # log in (opens a browser link)
sudo tailscale set --operator=$USER                    # lets serve.sh run without sudo
```

In the Tailscale admin console (DNS page), turn on **MagicDNS** and **HTTPS Certificates**. Install
Tailscale on your phone and log in with the same account.

Then, with the stack running:

```bash
devops/tailscale/serve.sh     # prints your https://<pc>.ts.net URLs
```

Set the printed Gateway URL as `GATEWAY_PUBLIC_URL` in `devops/.env`, rebuild the frontend
(`cd devops && docker compose up -d --build frontend`), and open `https://<pc>.ts.net` on your
phone. `tailscale serve` settings survive reboots; `tailscale serve reset` removes them.

## Git rule for Claude and every agent

**Never stage or commit anything unless the user explicitly says so** ("stage this", "commit
this"). Finishing a task, ticking a plan box, or being told "ok, go ahead" is *not* permission.
Leave all changes unstaged in the working tree so the user can review the diff first.
