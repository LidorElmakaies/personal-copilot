# personal-copilot

A personal NestJS + Expo app, self-hosted on a home PC and used from a phone over Tailscale.
Today it shows Shabbat times (candle lighting, Havdalah, countdown) for the phone's location on the
Home screen, with optional login; signed in, you can set a weekly candle-lighting reminder,
delivered as a Web Push notification. A Jewish-calendar tab is next — see
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

**Reminders on the phone** arrive as Web Push notifications, even with the screen locked and the
browser in the background: sign in, then tap "Turn on" (or the Account tab's Notifications switch)
and allow. If nothing arrives on the phone while the PC gets it, the message reached Google's push
service and the phone held it back. In Android's settings, allow the browser's notifications and
set its battery use to Unrestricted. Swiping the browser out of recent apps can force-stop it on
some phones, and a stopped app gets nothing until it's opened again. Chrome is the most reliable
browser for this; Brave works once those settings allow it.

## Git rule for Claude and every agent

**Never stage or commit anything unless the user explicitly says so** ("stage this", "commit
this"). Finishing a task, ticking a plan box, or being told "ok, go ahead" is *not* permission.
Leave all changes unstaged in the working tree so the user can review the diff first.
