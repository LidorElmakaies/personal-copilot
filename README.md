# personal-copilot

A NestJS + Expo scaffold: Gateway, Auth Service (Postgres-backed login/JWT), full OTel
observability, and a frontend with working login/register — the shared infrastructure this project
started with, kept as the base for whatever feature comes next. No product feature is built on top
of it yet.

See [CLAUDE.md](CLAUDE.md) for architecture, setup, and how this repo is organized —
[docs/specs/](docs/specs/) for the service/event contracts.

## Git rule for Claude and every agent

**Never stage or commit anything unless the user explicitly says so** ("stage this", "commit
this"). Finishing a task, ticking a plan box, or being told "ok, go ahead" is *not* permission.
Leave all changes unstaged in the working tree so the user can review the diff first.
