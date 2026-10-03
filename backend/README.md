# backend

NestJS monorepo (Nest CLI monorepo mode). See the root [CLAUDE.md](../CLAUDE.md) for architecture
and [docs/specs/](../docs/specs/) for the service/event contracts.

```bash
npm install
cp .env.example .env        # for local (non-Docker) runs
npx nest start gateway --watch     # or: users, calendar, reminders, notifications
npm test                           # jest.config.js — unit + API tests across apps/libs
npm run lint
```
