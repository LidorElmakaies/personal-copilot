// node --test scripts/docs-check.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CHECKS, context, docsFor } = require('./docs-check');

// A tiny repo every check passes on; each test breaks one thing in a copy of it.
const BASE = {
  'CLAUDE.md': '## Versions\n\nOne per component (`gateway`, `frontend`).\n\nRun `scripts/tool.js`, see [services](docs/specs/services.md) and `src/proxy/`.\n',
  'version/versions.json': '{ "gateway": "1.0.0", "frontend": "1.0.0" }\n',
  'scripts/tool.js': '',
  'backend/.env.example': '# No PORT here\nLIB_VAR=1\nSVC_URL=http://x\n',
  'backend/apps/gateway/src/main.ts': "import { startThing } from '@app/lib1';\nconst port = process.env.PORT;\n",
  'backend/apps/gateway/src/proxy/proxy.module.ts': "import { ConfigService } from '@nestjs/config';\nconst NAMES = ['SVC_URL'];\n",
  'backend/apps/gateway/src/proxy/proxy.routes.ts': "export const PROXY_ROUTES = [{ method: 'POST', path: '/auth/login' }];\n",
  'backend/apps/gateway/src/calendar/calendar.controller.ts': "@Controller('calendar')\nexport class CalendarController {\n  @Get('shabbat') get() {}\n}\n",
  'backend/apps/gateway/src/realtime/realtime.gateway.ts': "@WebSocketGateway({ path: '/ws', cors: true })\nexport class G {}\n",
  'backend/libs/lib1/src/index.ts': "export * from './thing';\nexport * from './other';\n",
  'backend/libs/lib1/src/thing.ts': 'export function startThing() {\n  return process.env.LIB_VAR;\n}\n',
  'backend/libs/lib1/src/other.ts': 'export function unused() {\n  return process.env.UNUSED_VAR;\n}\n',
  'docs/gateway/environment.md': '# Gateway\n\n- **`PORT`** — its port.\n- **`LIB_VAR`** / **`SVC_URL`** — two more.\n',
  'backend/libs/kafka-contracts/src/topics.ts': "export const KAFKA_TOPICS = {\n  USER_STATE: 'users.user-state',\n} as const;\n",
  'devops/kafka/docker-compose.yml': '    command: |\n      create() {\n      }\n      create users.user-state --config cleanup.policy=compact\n',
  'backend/libs/queue-contracts/src/queues.ts': "export const QUEUES = {\n  REMINDER_DUE: 'reminder-due',\n} as const;\n",
  'docs/specs/event-schemas.md':
    '# Queues\n\n| Queue | Notes |\n|---|---|\n| `reminder-due` | x |\n\n## `reminder-due`\n\n# Kafka events\n\n| Topic | Notes |\n|---|---|\n| `users.user-state` | x |\n\n## `users.user-state`\n',
  'frontend/Caddyfile': '{\n\t@gateway path /auth/* /calendar/* /ws*\n}\n',
  'devops/docker-compose.yml': 'include:\n  - path: gateway/docker-compose.yml\n',
  'devops/gateway/docker-compose.yml': 'services:\n  gateway:\n    extends:\n      file: ../common.yml\n    environment:\n      - JWT_SECRET=${JWT_SECRET}\n',
  'devops/common.yml': 'x:\n  image: ${IMAGE_TAG:-1}\n',
  'devops/android/apk.js': "const url = setting('APK_URL');\n",
  'devops/.env.example': 'JWT_SECRET=x\nIMAGE_TAG=1\n# APK_URL=\n',
  'docs/devops/environment.md': '`JWT_SECRET`, `IMAGE_TAG` and `APK_URL`.\n',
  'docs/specs/services.md': '# Services\n\n## gateway\n\n## frontend\n\n## Versions\n\n## libs/lib1\n',
  'docs/specs/architecture.md':
    '# Architecture\n\n## System topology\n\n```mermaid\nflowchart LR\n    subgraph Home["Home PC"]\n        Gateway["gateway\\n:8000"]\n        Frontend["frontend"]\n        Postgres[("postgres")]\n    end\n```\n',
};

function repo(changes = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-check-'));
  for (const [file, content] of Object.entries({ ...BASE, ...changes })) {
    if (content === null) continue;
    fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const run = (name, changes) => CHECKS[name](context(repo(changes))).map((p) => `${p.file}:${p.line} ${p.message}`);

test('the base fixture passes every check', () => {
  const ctx = context(repo());
  for (const [name, check] of Object.entries(CHECKS)) assert.deepStrictEqual(check(ctx), [], name);
});

test('doc paths: a missing path or link target fails; braces, suffixes and the allowlist pass', () => {
  assert.deepStrictEqual(run('doc paths exist', { 'README.md': 'See `scripts/{tool,gone}.js`, `devops/data/apk/latest.json` and [x](docs/nope.md).\n' }), [
    'README.md:1 link target docs/nope.md doesn\'t exist',
    'README.md:1 path `scripts/gone.js` doesn\'t exist',
  ]);
  assert.deepStrictEqual(run('doc paths exist', { 'README.md': '```\n`not/checked.js`\n```\nA zone `Asia/Jerusalem`, a MIME `text/html`, a route `/auth/login`.\n' }), []);
  // docs/plans/ isn't checked
  assert.deepStrictEqual(run('doc paths exist', { 'docs/plans/x/README.md': '`gone/file.js`\n' }), []);
});

test('env: unread, undocumented and missing-from-.env.example vars fail; unused lib files are ignored', () => {
  const undocumented = run('env vars documented', { 'docs/gateway/environment.md': '- **`PORT`** — x\n- **`SVC_URL`** — y\n' });
  assert.match(undocumented.join('\n'), /docs\/gateway\/environment\.md:1 LIB_VAR \(read at backend\/libs\/lib1\/src\/thing\.ts:2\) isn't documented/);
  const stale = run('env vars documented', { 'docs/gateway/environment.md': `${BASE['docs/gateway/environment.md']}- **\`OLD_VAR\`** — gone.\n` });
  assert.deepStrictEqual(stale, ['docs/gateway/environment.md:5 OLD_VAR is documented but gateway never reads it']);
  const example = run('env vars documented', { 'backend/.env.example': 'LIB_VAR=1\nSVC_URL=x\n' });
  assert.deepStrictEqual(example, ['backend/.env.example:1 PORT (read at backend/apps/gateway/src/main.ts:2) isn\'t in it']);
  const noDoc = run('env vars documented', { 'docs/gateway/environment.md': null });
  assert.match(noDoc[0], /docs\/gateway\/environment\.md:1 missing/);
});

test('Kafka topics: code, kafka-init and event-schemas must hold the same set', () => {
  const extra = run('Kafka topics agree', { 'devops/kafka/docker-compose.yml': `${BASE['devops/kafka/docker-compose.yml']}      create orphan.topic\n` });
  assert.deepStrictEqual(extra, ["devops/kafka/docker-compose.yml:5 kafka-init's create list has `orphan.topic`, which isn't in backend/libs/kafka-contracts/src/topics.ts"]);
  const misplaced = run('Kafka topics agree', {
    'docs/specs/event-schemas.md': BASE['docs/specs/event-schemas.md'].replace('## `reminder-due`\n\n', '') + '\n## `reminder-due`\n',
  });
  assert.match(misplaced.join('\n'), /the Kafka topic sections has `reminder-due`/);
});

test('queues: QUEUES and event-schemas sections and table must hold the same set', () => {
  const missing = run('queues agree', { 'docs/specs/event-schemas.md': BASE['docs/specs/event-schemas.md'].replace('| `reminder-due` | x |\n', '') });
  assert.deepStrictEqual(missing, ['docs/specs/event-schemas.md:1 the queue table lacks `reminder-due` (backend/libs/queue-contracts/src/queues.ts:2)']);
});

test('env: a var a shared lib reads may be documented once on the shared page instead', () => {
  const appDoc = '- **`PORT`** — x\n- **`SVC_URL`** — y\n';
  assert.deepStrictEqual(run('env vars documented', { 'docs/gateway/environment.md': appDoc, 'docs/backend/environment.md': '- **`LIB_VAR`** — z\n' }), []);
  // an app's own read still belongs on its page, and the shared page lists only what a lib reads
  const misplaced = run('env vars documented', { 'docs/gateway/environment.md': '- **`LIB_VAR`** / **`SVC_URL`** — y\n', 'docs/backend/environment.md': '- **`PORT`** — x\n- **`GONE`** — z\n' });
  assert.deepStrictEqual(misplaced, [
    "docs/gateway/environment.md:1 PORT (read at backend/apps/gateway/src/main.ts:2) isn't documented",
    'docs/backend/environment.md:1 PORT is documented but no shared lib an app uses reads it',
    'docs/backend/environment.md:2 GONE is documented but no shared lib an app uses reads it',
  ]);
});

test('devops/.env: what compose and devops scripts read must be in .env.example and documented, and nothing more', () => {
  const missing = run('devops/.env agrees', { 'devops/.env.example': 'JWT_SECRET=x\nIMAGE_TAG=1\n' });
  assert.deepStrictEqual(missing, ["devops/.env.example:1 APK_URL (read at devops/android/apk.js:1) isn't in it"]);
  const stale = run('devops/.env agrees', { 'devops/.env.example': `${BASE['devops/.env.example']}OLD=1\n` });
  assert.deepStrictEqual(stale, ['devops/.env.example:4 OLD is set but no compose file or devops script reads it']);
  const undocumented = run('devops/.env agrees', { 'docs/devops/environment.md': '`JWT_SECRET`\n' });
  assert.deepStrictEqual(undocumented, [
    "docs/devops/environment.md:1 IMAGE_TAG (read at devops/common.yml:2) isn't documented",
    "docs/devops/environment.md:1 APK_URL (read at devops/android/apk.js:1) isn't documented",
  ]);
});

test("Caddy: every Gateway path must match @gateway", () => {
  const missing = run('Caddy covers Gateway', { 'frontend/Caddyfile': '\t@gateway path /auth/* /ws*\n' });
  assert.deepStrictEqual(missing, ["frontend/Caddyfile:1 @gateway doesn't match /calendar/shabbat (backend/apps/gateway/src/calendar/calendar.controller.ts:3)"]);
  assert.deepStrictEqual(run('Caddy covers Gateway', { 'frontend/Caddyfile': 'nothing\n' }), ['frontend/Caddyfile:1 no `@gateway path …` matcher']);
});

test('services: each backend app needs a services.md section and a topology node, and the reverse', () => {
  const newApp = run('services documented', { 'backend/apps/billing/src/main.ts': '' });
  assert.deepStrictEqual(newApp, ['docs/specs/services.md:1 no `## billing` section for backend/apps/billing', 'docs/specs/architecture.md:3 topology diagram has no `billing` node']);
  const stale = run('services documented', {
    'docs/specs/services.md': `${BASE['docs/specs/services.md']}\n## calendar\n`,
    'docs/specs/architecture.md': BASE['docs/specs/architecture.md'].replace('    end', '        Cal["calendar"]\n    end'),
  });
  assert.deepStrictEqual(stale, ['docs/specs/services.md:11 `## calendar` names no backend/apps/ service', 'docs/specs/architecture.md:11 topology node `calendar` names no backend/apps/ service']);
});

test("versions: versions.json and CLAUDE.md's Versions list must agree", () => {
  const extra = run('version components agree', { 'version/versions.json': '{ "gateway": "1.0.0", "frontend": "1.0.0", "ntfy": "1.0.0" }' });
  assert.deepStrictEqual(extra, ['CLAUDE.md:3 Versions list lacks `ntfy` (version/versions.json)']);
});

test('plan references fail outside docs/plans/ only', () => {
  const ref = 'tas' + 'k 2.14'; // split, so this file holds no reference itself
  assert.deepStrictEqual(run('no plan references', { 'backend/apps/gateway/src/x.ts': `// see ${ref}\n`, 'docs/plans/p/plan.md': `- ${ref}\n` }), [
    `backend/apps/gateway/src/x.ts:1 plan reference "${ref}" — plan progress belongs in docs/plans/ only`,
  ]);
});

test('--changed maps each changed path to its docs, listing optional READMEs only if present', () => {
  const dir = repo({ 'backend/apps/users/README.md': '' });
  const { docs, unmapped } = docsFor(dir, [
    'backend/apps/users/src/a.service.spec.ts',
    'backend/apps/gateway/src/main.ts',
    'backend/libs/otel/src/start-otel.ts',
    'devops/ntfy/server.yml',
    'frontend/src/x.js',
    'frontend/e2e/tests/home.spec.js',
    'scripts/tool.js',
    'docs/specs/services.md',
    'package.json',
  ]);
  const get = (d) => docs.get(d) ?? [];
  assert.deepStrictEqual(get('docs/specs/services.md — ## users'), ['backend/apps/users/src/a.service.spec.ts']);
  assert.deepStrictEqual(get('backend/apps/users/README.md'), ['backend/apps/users/src/a.service.spec.ts']);
  assert.ok(!docs.has('backend/apps/gateway/README.md'));
  assert.deepStrictEqual(get('.claude/agents/testing.md'), ['backend/apps/users/src/a.service.spec.ts', 'frontend/e2e/tests/home.spec.js']);
  assert.deepStrictEqual(get('.claude/agents/backend.md'), ['backend/apps/users/src/a.service.spec.ts', 'backend/apps/gateway/src/main.ts', 'backend/libs/otel/src/start-otel.ts']);
  assert.deepStrictEqual(get('docs/specs/services.md — ## libs/otel'), ['backend/libs/otel/src/start-otel.ts']);
  assert.deepStrictEqual(get('.claude/agents/devops.md'), ['devops/ntfy/server.yml']);
  assert.ok(!docs.has('docs/ntfy/environment.md'));
  assert.deepStrictEqual(get('frontend/README.md'), ['frontend/src/x.js']);
  assert.deepStrictEqual(get('frontend/e2e/README.md'), ['frontend/e2e/tests/home.spec.js']);
  assert.deepStrictEqual(get('CLAUDE.md — Versions, Commands'), ['scripts/tool.js']);
  assert.deepStrictEqual(unmapped, ['package.json']);
});

// ── failing cases the checks above don't exercise yet ───────────────────────

test("versions: an extra component in CLAUDE.md, or no list at all, fails", () => {
  const extra = run('version components agree', { 'CLAUDE.md': BASE['CLAUDE.md'].replace('`frontend`)', '`frontend`, `ntfy`)') });
  assert.deepStrictEqual(extra, ["CLAUDE.md:3 Versions list has `ntfy`, which isn't in version/versions.json"]);
  const noList = run('version components agree', { 'CLAUDE.md': '## Versions\n\nOne per component.\n' });
  assert.deepStrictEqual(noList, ['CLAUDE.md:1 Versions section has no (`component`, …) list']);
});

test('queues: a queue missing from the sections, or an extra one documented, fails', () => {
  const noSection = run('queues agree', { 'docs/specs/event-schemas.md': BASE['docs/specs/event-schemas.md'].replace('## `reminder-due`\n', '') });
  assert.deepStrictEqual(noSection, ['docs/specs/event-schemas.md:1 the queue sections lacks `reminder-due` (backend/libs/queue-contracts/src/queues.ts:2)']);
  const extra = run('queues agree', { 'docs/specs/event-schemas.md': BASE['docs/specs/event-schemas.md'].replace('## `reminder-due`\n', '## `reminder-due`\n\n## `old-queue`\n') });
  assert.deepStrictEqual(extra, ["docs/specs/event-schemas.md:9 the queue sections has `old-queue`, which isn't in backend/libs/queue-contracts/src/queues.ts"]);
});

test('Kafka topics: a topic in code but not created by kafka-init or in the topic table fails', () => {
  const topics = "export const KAFKA_TOPICS = {\n  USER_STATE: 'users.user-state',\n  RELEASES: 'frontend.releases',\n} as const;\n";
  const missing = run('Kafka topics agree', {
    'backend/libs/kafka-contracts/src/topics.ts': topics,
    'docs/specs/event-schemas.md': `${BASE['docs/specs/event-schemas.md']}\n## \`frontend.releases\`\n`,
  });
  assert.deepStrictEqual(missing, [
    "devops/kafka/docker-compose.yml:1 kafka-init's create list lacks `frontend.releases` (backend/libs/kafka-contracts/src/topics.ts:3)",
    'docs/specs/event-schemas.md:1 the Kafka topic table lacks `frontend.releases` (backend/libs/kafka-contracts/src/topics.ts:3)',
  ]);
});

test('env: a missing backend/.env.example fails', () => {
  assert.ok(run('env vars documented', { 'backend/.env.example': null }).includes('backend/.env.example:1 missing'));
});

test('services: a topology section without a mermaid diagram fails', () => {
  assert.deepStrictEqual(run('services documented', { 'docs/specs/architecture.md': '# A\n\n## System topology\n\nNo diagram.\n' }), [
    'docs/specs/architecture.md:3 no mermaid diagram under `## System topology`',
  ]);
});

test('plan references: the bare phrase with no task number fails too', () => {
  const ref = 'plan ' + 'task';
  assert.deepStrictEqual(run('no plan references', { 'README.md': `Done in the ${ref} before.\n` }), [
    `README.md:1 plan reference "${ref}" — plan progress belongs in docs/plans/ only`,
  ]);
});

// ── robustness ──

test('doc paths: the android/ and index.html allowlist entries hide a real missing path', () => {
  assert.deepStrictEqual(run('doc paths exist', { 'README.md': 'Run `devops/android/gone.js`; see `docs/gone/index.html`.\n' }), [
    'README.md:1 path `devops/android/gone.js` doesn\'t exist',
    'README.md:1 path `docs/gone/index.html` doesn\'t exist',
  ]);
});

test('services: a CRLF checkout (Git for Windows autocrlf) still finds the topology diagram', () => {
  assert.deepStrictEqual(run('services documented', { 'docs/specs/architecture.md': BASE['docs/specs/architecture.md'].replace(/\n/g, '\r\n') }), []);
});

test('env: a bullet whose bold runs past " — " is reported, not a crash', () => {
  assert.doesNotThrow(() => run('env vars documented', { 'docs/gateway/environment.md': `${BASE['docs/gateway/environment.md']}- **\`EXTRA\` — oops**\n` }));
});

test('doc paths: a link with a stray % is reported, not a crash', () => {
  assert.doesNotThrow(() => run('doc paths exist', { 'README.md': '[x](100%.md)\n' }));
});

test('Caddy: @Controller({ path }) routes are covered too', () => {
  const out = run('Caddy covers Gateway', { 'backend/apps/gateway/src/admin/admin.controller.ts': "@Controller({ path: 'admin' })\nexport class A {\n  @Get('status') s() {}\n}\n" });
  assert.strictEqual(out.length, 1);
});
