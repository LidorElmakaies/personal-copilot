# backend

NestJS monorepo (Nest CLI monorepo mode). See the root [CLAUDE.md](../CLAUDE.md) for architecture
and [docs/specs/](../docs/specs/) for the service/event contracts.

```bash
npm install
cp .env.example .env        # for local (non-Docker) runs
npx nest start gateway --watch     # or: auth
npm test
npm run lint
```
