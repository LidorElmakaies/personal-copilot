// Docs drift check: finds docs that disagree with the code, and which docs a change should touch.
// Plain Node, Linux and Windows alike.
//
//   node scripts/docs-check.js             run every check; exits 1 if any fails
//   node scripts/docs-check.js --changed   first list the docs to review for the uncommitted
//                                          changes (git diff HEAD + untracked), then run every check
//
// Tests: node --test scripts/docs-check.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// Changed path → docs to review. `docs` gets the regex match; a doc ending in `?` is listed only
// if that file exists. A label after ` — ` names the section to look at.
const DOCS_MAP = [
  { match: /^backend\/apps\/([^/]+)\//, docs: ([, app]) => [`docs/specs/services.md — ## ${app}`, `docs/${app}/environment.md`, `backend/apps/${app}/README.md?`, `CLAUDE.md — What's implemented: ${app}`, '.claude/agents/backend.md'] },
  { match: /^backend\/libs\/([^/]+)\//, docs: ([, lib]) => [`docs/specs/services.md — ## libs/${lib}`, `backend/libs/${lib}/README.md?`, 'docs/backend/environment.md', 'CLAUDE.md — Architecture', '.claude/agents/backend.md'] },
  { match: /^backend\/\.env\.example$/, docs: () => ['docs/<app>/environment.md — each app reading a changed variable', 'CLAUDE.md — First run'] },
  { match: /^devops\/(?:([^/]+)\/)?/, docs: ([, dir]) => ['docs/specs/architecture.md — System topology, Compose & build layout', 'docs/devops/environment.md', ...(dir ? [`docs/${dir}/environment.md?`] : []), '.claude/agents/devops.md'] },
  { match: /^frontend\/(src|app)\//, docs: () => ['docs/specs/services.md — ## frontend', 'frontend/README.md', '.claude/agents/frontend.md', "CLAUDE.md — What's implemented: frontend"] },
  { match: /^frontend\/(public\/|Caddyfile$)/, docs: () => ['docs/specs/services.md — ## frontend', 'docs/specs/architecture.md — System topology', 'frontend/README.md'] },
  { match: /^frontend\/e2e\//, docs: () => ['frontend/e2e/README.md', '.claude/agents/testing.md'] },
  { match: /\.spec\.ts$/, docs: () => ['.claude/agents/testing.md'] },
  { match: /^(scripts|version)\//, docs: () => ['CLAUDE.md — Versions, Commands', 'README.md'] },
];

// Paths docs may name that never exist in a checkout: gitignored or created at runtime. An entry
// matches that exact path; one ending in `/` also matches everything under it.
const PATH_ALLOWLIST = [
  'latest.json', // APK registry index, written by apk.js publish
  'releases.json', // APK registry history, written by apk.js publish
  'index.html', // APK registry download page, written by apk.js publish
  'devops/data/', // every service's runtime data (volumes, APK registry, signing key)
  '.env', // the real env files, copied from their .env.example
  'backend/.env',
  'devops/.env',
  'frontend/.env',
  'devops/frontend/.env.cloud',
  'backend/node_modules/',
  'kafka-console-producer.sh', // ships in the Kafka image
  'android/', // Expo prebuild's generated native project, named from frontend/
  'screenshots', // Playwright output, named from frontend/e2e/
  'test-results',
  'playwright-report',
  'process.env', // Node's, named in prose
  '../version', // build-info's lookup, relative to the working directory
];

// `## <name>` sections in services.md / topology nodes that aren't backend/apps.
const NON_APP_SECTIONS = ['frontend'];
const NON_APP_NODES = ['frontend', 'tailscale'];

const PLAN_REF = [/\b(?:plan\s+)?tasks?\s+\d+\.\d+[a-z]?\b/i, /\bplan\s+tasks?\b/i];

// ── repo access ──────────────────────────────────────────────────────────────

// quotepath off: non-ASCII file names come out as-is.
const git = (root, ...args) =>
  execFileSync('git', ['-c', 'core.quotepath=off', '-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });

/** Every file in the repo (git's view: tracked + untracked, not ignored), as posix paths. */
function listFiles(root) {
  try {
    const top = git(root, 'rev-parse', '--show-toplevel').trim();
    const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
    if (same(fs.realpathSync(top), fs.realpathSync(root))) {
      const out = git(root, 'ls-files', '-co', '--exclude-standard');
      return out.split('\n').filter((f) => f && fs.existsSync(path.join(root, f)));
    }
  } catch {
    // not a git checkout (test fixtures): walk the tree instead
  }
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel);
      else files.push(rel);
    }
  };
  walk('');
  return files;
}

function context(root) {
  const files = listFiles(root);
  const fileSet = new Set(files);
  const dirSet = new Set();
  for (const f of files) {
    for (let d = path.posix.dirname(f); d !== '.'; d = path.posix.dirname(d)) dirSet.add(d);
  }
  const cache = new Map();
  const read = (rel) => {
    if (!cache.has(rel)) {
      const p = path.join(root, rel);
      cache.set(rel, fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null);
    }
    return cache.get(rel);
  };
  return { root, files, fileSet, dirSet, read };
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const problem = (file, line, message) => ({ file, line, message });

/** The docs whose file paths are checked: CLAUDE.md, READMEs, specs, environment pages, agent guides. */
const docFiles = (ctx) =>
  ctx.files.filter(
    (f) =>
      !f.startsWith('docs/plans/') &&
      (f === 'CLAUDE.md' ||
        /(^|\/)README\.md$/.test(f) ||
        /^docs\/specs\/[^/]+\.md$/.test(f) ||
        /^docs\/[^/]+\/environment\.md$/.test(f) ||
        /^\.claude\/agents\/[^/]+\.md$/.test(f)),
  );

/** `## heading` sections of a markdown file: { title, line, body }. */
function sections(text, level = 2) {
  const re = new RegExp(`^${'#'.repeat(level)} (.+)$`, 'gm');
  const heads = [...text.matchAll(re)];
  return heads.map((m, i) => ({
    title: m[1].trim(),
    line: lineAt(text, m.index),
    body: text.slice(m.index, i + 1 < heads.length ? heads[i + 1].index : text.length),
  }));
}

const backendApps = (ctx) => [...new Set(ctx.files.map((f) => /^backend\/apps\/([^/]+)\//.exec(f)?.[1]).filter(Boolean))].sort();

// ── a. file paths in docs exist ─────────────────────────────────────────────

const PATH_EXT = /\.(md|js|cjs|mjs|ts|tsx|jsx|json|ya?ml|html|css|sh|env|example|conf|toml|txt|png|svg|ico|apk)$/;

/** A backticked token that names a repo path, normalized; null if it doesn't look like one. */
function asPath(token) {
  const t = token.replace(/#.*$/, '').replace(/:\d+(-\d+)?$/, '').replace(/^\.\//, '');
  if (!/^[\w.~-][\w.@/-]*$/.test(t) || /^[a-z]+:/.test(t)) return null;
  if (/^(application|text|image|audio|video|font)\/[\w.+-]+$/.test(t)) return null; // MIME type
  if (/^\w[\w-]*(\.[\w-]+)+\//.test(t)) return null; // host/path, e.g. a registry image
  if (/^(Africa|America|Asia|Atlantic|Australia|Europe|Indian|Pacific|Etc)\//.test(t)) return null; // time zone
  if (/^\.\w+$/.test(t) && t !== '.env') return null; // an extension
  if (!t.includes('/') && !PATH_EXT.test(t) && !/^(Caddyfile|Dockerfile)$/.test(t)) return null;
  return t.replace(/\/$/, '');
}

const safeDecode = (s) => {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
};

const expandBraces = (t) => {
  const m = /^([^{}]*)\{([^{}]+)\}([^{}]*)$/.exec(t);
  return m ? m[2].split(',').map((part) => m[1] + part + m[3]) : [t];
};

function checkPaths(ctx) {
  const out = [];
  const exists = (p) => ctx.fileSet.has(p) || ctx.dirSet.has(p);
  const allowed = (p) => PATH_ALLOWLIST.some((a) => p === a.replace(/\/$/, '') || (a.endsWith('/') && p.startsWith(a)));
  // A doc often names a file relative to the app or folder it's about (`src/proxy/`), so a suffix
  // of a real path counts.
  const suffixes = new Set();
  for (const p of [...ctx.fileSet, ...ctx.dirSet]) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) suffixes.add(parts.slice(i).join('/'));
  }
  for (const doc of docFiles(ctx)) {
    const dir = path.posix.dirname(doc);
    let fenced = false;
    ctx.read(doc).split('\n').forEach((line, i) => {
      if (/^\s*```/.test(line)) fenced = !fenced;
      if (fenced) return;
      for (const [, target] of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^([a-z]+:|#)/.test(target)) continue;
        const p = path.posix.normalize(path.posix.join(dir, safeDecode(target.replace(/[#?].*$/, '')))).replace(/\/$/, '');
        if (!exists(p) && !allowed(p)) out.push(problem(doc, i + 1, `link target ${target} doesn't exist`));
      }
      for (const [, token] of line.matchAll(/`([^`\n]+)`/g)) {
        for (const p of expandBraces(token).map(asPath).filter(Boolean)) {
          const local = path.posix.normalize(path.posix.join(dir, p));
          if (exists(p) || exists(local) || suffixes.has(p) || allowed(p)) continue;
          out.push(problem(doc, i + 1, `path \`${p}\` doesn't exist`));
        }
      }
    });
  }
  return out;
}

// ── b. env vars: code ↔ docs/<app>/environment.md ↔ backend/.env.example ────

/** Env vars a set of source files reads: name → first "file:line" that reads it. */
function envReads(ctx, files) {
  const reads = new Map();
  const add = (name, file, text, index) => reads.has(name) || reads.set(name, `${file}:${lineAt(text, index)}`);
  for (const f of files) {
    const text = ctx.read(f);
    for (const m of text.matchAll(/\.(?:get|getOrThrow)(?:<[^>]*>)?\(\s*'([A-Z][A-Z0-9_]*)'/g)) add(m[1], f, text, m.index);
    for (const m of text.matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*'([A-Z][A-Z0-9_]*)'\s*\])/g)) add(m[1] || m[2], f, text, m.index);
    // A name handed to ConfigService through a variable: any ALL_CAPS literal in a file using it.
    if (/\bConfigService\b/.test(text)) {
      for (const m of text.matchAll(/'([A-Z][A-Z0-9]*_[A-Z0-9_]+)'/g)) add(m[1], f, text, m.index);
    }
  }
  return reads;
}

/** An app's source files plus the lib files it uses: each name imported from @app/<lib> leads to
 *  the file that exports it, then on through relative imports. */
function appSources(ctx, app) {
  const isSrc = (f) => /\.ts$/.test(f) && !/\.spec\.ts$/.test(f);
  const files = ctx.files.filter((f) => f.startsWith(`backend/apps/${app}/src/`) && isSrc(f));
  const seen = new Set(files);
  const add = (f) => seen.has(f) || (seen.add(f), files.push(f));
  for (let i = 0; i < files.length; i++) {
    const text = ctx.read(files[i]);
    for (const [, rel] of text.matchAll(/from '(\.{1,2}\/[^']+)'/g)) {
      const base = path.posix.join(path.posix.dirname(files[i]), rel);
      const hit = [`${base}.ts`, `${base}/index.ts`].find((f) => ctx.fileSet.has(f));
      if (hit) add(hit);
    }
    for (const [, names, lib] of text.matchAll(/import\s+\{([^}]+)\}\s+from '@app\/([\w-]+)'/g)) {
      const libFiles = ctx.files.filter((f) => f.startsWith(`backend/libs/${lib}/src/`) && isSrc(f));
      for (const raw of names.split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0];
        if (!name || name.startsWith('type ')) continue;
        const def = new RegExp(`export\\s+(?:declare\\s+|abstract\\s+|async\\s+)*(?:class|function|const|let|enum)\\s+${name}\\b`);
        libFiles.filter((f) => def.test(ctx.read(f))).forEach(add);
      }
    }
  }
  return files;
}

/** Vars an environment page documents: backticked names in a bullet's leading bold, or a heading. */
function documentedVars(text) {
  const vars = new Map();
  text.split('\n').forEach((line, i) => {
    const head = /^\s*-\s+\*\*/.test(line) ? (line.split(' — ')[0].match(/\*\*.+?\*\*/g) ?? [line]).join(' ') : /^#{2,}\s/.test(line) && line;
    if (!head) return;
    for (const [, v] of head.matchAll(/`([A-Z][A-Z0-9_]*)`/g)) vars.has(v) || vars.set(v, i + 1);
  });
  return vars;
}

// Vars a shared lib reads may be documented once here instead of on each app's page.
const SHARED_ENV_DOC = 'docs/backend/environment.md';

function checkEnv(ctx) {
  const out = [];
  const example = ctx.read('backend/.env.example');
  if (example === null) out.push(problem('backend/.env.example', 1, 'missing'));
  const shared = documentedVars(ctx.read(SHARED_ENV_DOC) ?? '');
  const libReads = new Set();
  for (const app of backendApps(ctx)) {
    const reads = envReads(ctx, appSources(ctx, app));
    const docPath = `docs/${app}/environment.md`;
    const doc = ctx.read(docPath);
    if (doc === null) {
      out.push(problem(docPath, 1, `missing — ${app} reads ${[...reads.keys()].join(', ') || 'no env vars'}`));
      continue;
    }
    const documented = documentedVars(doc);
    for (const [v, where] of reads) {
      const fromLib = where.startsWith('backend/libs/');
      if (fromLib) libReads.add(v);
      if (!documented.has(v) && !(fromLib && shared.has(v))) out.push(problem(docPath, 1, `${v} (read at ${where}) isn't documented`));
      if (example !== null && !new RegExp(`\\b${v}\\b`).test(example)) {
        out.push(problem('backend/.env.example', 1, `${v} (read at ${where}) isn't in it`));
      }
    }
    for (const [v, line] of documented) {
      if (!reads.has(v)) out.push(problem(docPath, line, `${v} is documented but ${app} never reads it`));
    }
  }
  for (const [v, line] of shared) {
    if (!libReads.has(v)) out.push(problem(SHARED_ENV_DOC, line, `${v} is documented but no shared lib an app uses reads it`));
  }
  const seen = new Set();
  return out.filter((p) => !seen.has(p.file + p.message) && seen.add(p.file + p.message));
}

/** Vars `devops/.env` feeds: `${VAR}` in the app stack's compose files, and `setting('VAR')` in devops/ scripts. */
function devopsEnvReads(ctx) {
  const stack = ctx.read('devops/docker-compose.yml') ?? '';
  const compose = [...stack.matchAll(/^\s*-\s*path:\s*(\S+)/gm)].map((m) => `devops/${m[1]}`);
  for (const f of [...compose]) {
    for (const [, ext] of (ctx.read(f) ?? '').matchAll(/^\s*file:\s*(\S+)/gm)) compose.push(path.posix.join(path.posix.dirname(f), ext));
  }
  const scripts = ctx.files.filter((f) => /^devops\/[^/]+\/[^/]+\.js$/.test(f) && !f.endsWith('.test.js'));
  const reads = new Map();
  for (const f of [...new Set(compose), 'devops/docker-compose.yml', ...scripts]) {
    const text = ctx.read(f) ?? '';
    const re = f.endsWith('.js') ? /\bsetting\(\s*'([A-Z][A-Z0-9_]*)'/g : /\$\{([A-Z][A-Z0-9_]*)/g;
    for (const m of text.matchAll(re)) reads.has(m[1]) || reads.set(m[1], `${f}:${lineAt(text, m.index)}`);
  }
  return reads;
}

function checkDevopsEnv(ctx) {
  const out = [];
  const exampleFile = 'devops/.env.example';
  const example = ctx.read(exampleFile);
  if (example === null) return [problem(exampleFile, 1, 'missing')];
  const docFile = 'docs/devops/environment.md';
  const doc = ctx.read(docFile) ?? '';
  const reads = devopsEnvReads(ctx);
  for (const [v, where] of reads) {
    if (!new RegExp(`\\b${v}\\b`).test(example)) out.push(problem(exampleFile, 1, `${v} (read at ${where}) isn't in it`));
    if (!doc.includes(`\`${v}\``)) out.push(problem(docFile, 1, `${v} (read at ${where}) isn't documented`));
  }
  example.split('\n').forEach((line, i) => {
    const m = /^\s*#?\s*([A-Z][A-Z0-9_]*)=/.exec(line);
    if (m && !reads.has(m[1])) out.push(problem(exampleFile, i + 1, `${m[1]} is set but no compose file or devops script reads it`));
  });
  return out;
}

// ── c, d. Kafka topics and BullMQ queues ────────────────────────────────────

/** String values of `export const NAME = { KEY: 'value', … }` in a TS file: value → line. */
function constValues(text, name) {
  const start = text.indexOf(`${name} = {`);
  if (start < 0) return new Map();
  const body = text.slice(start, text.indexOf('}', start));
  return new Map([...body.matchAll(/:\s*'([^']+)'/g)].map((m) => [m[1], lineAt(text, start + m.index)]));
}

/** event-schemas.md's `## \`name\`` headings and table rows, split at its `# Kafka events` part. */
function eventSchemas(ctx) {
  const file = 'docs/specs/event-schemas.md';
  const text = ctx.read(file) ?? '';
  const split = text.search(/^# Kafka events/m);
  const kafkaAt = split < 0 ? text.length : split;
  const queues = new Map();
  const topics = new Map();
  const queueRows = new Map();
  const topicRows = new Map();
  for (const m of text.matchAll(/^## `([^`]+)`/gm)) (m.index < kafkaAt ? queues : topics).set(m[1], lineAt(text, m.index));
  for (const m of text.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)) (m.index < kafkaAt ? queueRows : topicRows).set(m[1], lineAt(text, m.index));
  return { file, queues, topics, queueRows, topicRows };
}

/** Each named set must hold exactly the names of `reference`. */
function sameSet(reference, others) {
  const out = [];
  for (const { file, names, what } of others) {
    for (const [n] of reference.names) {
      if (!names.has(n)) out.push(problem(file, 1, `${what} lacks \`${n}\` (${reference.file}:${reference.names.get(n)})`));
    }
    for (const [n, line] of names) {
      if (!reference.names.has(n)) out.push(problem(file, line, `${what} has \`${n}\`, which isn't in ${reference.file}`));
    }
  }
  return out;
}

function checkTopics(ctx) {
  const file = 'backend/libs/kafka-contracts/src/topics.ts';
  const compose = 'devops/kafka/docker-compose.yml';
  const composeText = ctx.read(compose) ?? '';
  const created = new Map([...composeText.matchAll(/^\s*create\s+([\w.-]+)/gm)].map((m) => [m[1], lineAt(composeText, m.index)]));
  const schemas = eventSchemas(ctx);
  return sameSet({ file, names: constValues(ctx.read(file) ?? '', 'KAFKA_TOPICS') }, [
    { file: compose, names: created, what: "kafka-init's create list" },
    { file: schemas.file, names: schemas.topics, what: 'the Kafka topic sections' },
    { file: schemas.file, names: schemas.topicRows, what: 'the Kafka topic table' },
  ]);
}

function checkQueues(ctx) {
  const file = 'backend/libs/queue-contracts/src/queues.ts';
  const schemas = eventSchemas(ctx);
  return sameSet({ file, names: constValues(ctx.read(file) ?? '', 'QUEUES') }, [
    { file: schemas.file, names: schemas.queues, what: 'the queue sections' },
    { file: schemas.file, names: schemas.queueRows, what: 'the queue table' },
  ]);
}

// ── e. Caddy's @gateway covers every Gateway route ──────────────────────────

/** Every path Gateway serves: path → where it's declared. */
function gatewayPaths(ctx) {
  const paths = new Map();
  const routesFile = 'backend/apps/gateway/src/proxy/proxy.routes.ts';
  const routes = ctx.read(routesFile) ?? '';
  for (const m of routes.matchAll(/path:\s*'([^']+)'/g)) paths.set(m[1], `${routesFile}:${lineAt(routes, m.index)}`);
  for (const f of ctx.files.filter((f) => /^backend\/apps\/gateway\/src\/.*\.ts$/.test(f) && !f.endsWith('.spec.ts'))) {
    const text = ctx.read(f);
    const ws = /@WebSocketGateway\(\{[^}]*path:\s*'([^']+)'/.exec(text);
    if (ws) paths.set(ws[1], `${f}:${lineAt(text, ws.index)}`);
    // Each @Controller('x') / @Controller({ path: 'x' }) / @Controller() up to the next one.
    const ctrls = [...text.matchAll(/@Controller\(\s*(?:'([^']*)'|\{[^}]*?path:\s*'([^']*)'[^}]*\})?/g)];
    ctrls.forEach((c, i) => {
      const end = i + 1 < ctrls.length ? ctrls[i + 1].index : text.length;
      for (const m of text.slice(c.index, end).matchAll(/@(?:Get|Post|Put|Patch|Delete|All)\(\s*(?:'([^']*)')?/g)) {
        const p = `/${[c[1] ?? c[2], m[1]].filter(Boolean).join('/')}`.replace(/\/+/g, '/');
        paths.set(p, `${f}:${lineAt(text, c.index + m.index)}`);
      }
    });
  }
  return paths;
}

function checkCaddy(ctx) {
  const file = 'frontend/Caddyfile';
  const text = ctx.read(file) ?? '';
  const m = /^\s*@gateway\s+path\s+(.+)$/m.exec(text);
  if (!m) return [problem(file, 1, 'no `@gateway path …` matcher')];
  // Caddy's path matcher: exact, with `*` matching anything (slashes included).
  const globs = m[1].trim().split(/\s+/).map((g) => new RegExp(`^${g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`));
  const line = lineAt(text, m.index + m[0].search(/\S/));
  return [...gatewayPaths(ctx)]
    .filter(([p]) => !globs.some((g) => g.test(p)))
    .map(([p, where]) => problem(file, line, `@gateway doesn't match ${p} (${where})`));
}

// ── f. every backend app has a services.md section and a topology node ──────

function checkServices(ctx) {
  const out = [];
  const apps = backendApps(ctx);
  const servicesFile = 'docs/specs/services.md';
  const heads = sections(ctx.read(servicesFile) ?? '').filter((s) => /^[a-z][\w-]*$/.test(s.title));
  for (const app of apps) {
    if (!heads.some((s) => s.title === app)) out.push(problem(servicesFile, 1, `no \`## ${app}\` section for backend/apps/${app}`));
  }
  for (const s of heads) {
    if (!apps.includes(s.title) && !NON_APP_SECTIONS.includes(s.title)) out.push(problem(servicesFile, s.line, `\`## ${s.title}\` names no backend/apps/ service`));
  }
  const archFile = 'docs/specs/architecture.md';
  const arch = ctx.read(archFile) ?? '';
  const topo = sections(arch).find((s) => s.title === 'System topology');
  const block = topo && /```mermaid\n([\s\S]*?)```/.exec(topo.body);
  if (!block) return [...out, problem(archFile, topo ? topo.line : 1, 'no mermaid diagram under `## System topology`')];
  const blockStart = topo.line + lineAt(topo.body, block.index) - 1;
  const nodes = [...block[1].matchAll(/^(?!\s*subgraph)[^\n]*?\b\w+(\[\(|\(\[|\(\(|\[)"([^"]*)"/gm)].map((n) => ({
    shape: n[1],
    name: n[2].split(/\\n|\s/)[0],
    line: blockStart + lineAt(block[1], n.index),
  }));
  for (const app of apps) {
    if (!nodes.some((n) => n.name === app)) out.push(problem(archFile, topo.line, `topology diagram has no \`${app}\` node`));
  }
  for (const n of nodes) {
    // Plain boxes are services; stores, people and external services have other shapes.
    if (n.shape === '[' && !apps.includes(n.name) && !NON_APP_NODES.includes(n.name)) {
      out.push(problem(archFile, n.line, `topology node \`${n.name}\` names no backend/apps/ service`));
    }
  }
  return out;
}

// ── g. versions.json ↔ CLAUDE.md's Versions section ─────────────────────────

function checkVersions(ctx) {
  const versions = Object.keys(JSON.parse(ctx.read('version/versions.json') ?? '{}'));
  const text = ctx.read('CLAUDE.md') ?? '';
  const section = sections(text).find((s) => /^Versions\b/.test(s.title));
  const list = section && /\(([^()]*`[^()]*)\)/.exec(section.body);
  if (!list) return [problem('CLAUDE.md', section ? section.line : 1, "Versions section has no (`component`, …) list")];
  const line = section.line + lineAt(section.body, list.index) - 1;
  const named = [...list[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  return [
    ...versions.filter((v) => !named.includes(v)).map((v) => problem('CLAUDE.md', line, `Versions list lacks \`${v}\` (version/versions.json)`)),
    ...named.filter((v) => !versions.includes(v)).map((v) => problem('CLAUDE.md', line, `Versions list has \`${v}\`, which isn't in version/versions.json`)),
  ];
}

// ── h. no plan references outside docs/plans/ ──────────────────────────

function checkPlanRefs(ctx) {
  const out = [];
  for (const f of ctx.files) {
    if (f.startsWith('docs/plans/')) continue;
    const buf = fs.readFileSync(path.join(ctx.root, f));
    if (buf.length > 2 << 20 || buf.subarray(0, 8000).includes(0)) continue; // big or binary
    buf.toString('utf8').split('\n').forEach((line, i) => {
      const m = PLAN_REF.map((re) => re.exec(line)).find(Boolean);
      if (m) out.push(problem(f, i + 1, `plan reference "${m[0]}" — plan progress belongs in docs/plans/ only`));
    });
  }
  return out;
}

const CHECKS = {
  'doc paths exist': checkPaths,
  'env vars documented': checkEnv,
  'devops/.env agrees': checkDevopsEnv,
  'Kafka topics agree': checkTopics,
  'queues agree': checkQueues,
  'Caddy covers Gateway': checkCaddy,
  'services documented': checkServices,
  'version components agree': checkVersions,
  'no plan references': checkPlanRefs,
};

function runChecks(root = ROOT) {
  const ctx = context(root);
  return Object.entries(CHECKS).map(([name, check]) => ({ name, problems: check(ctx) }));
}

// ── --changed ───────────────────────────────────────────────────────────────

function changedFiles(root) {
  const lines = (...args) => git(root, ...args).split('\n').filter(Boolean);
  return [...new Set([...lines('diff', '--name-only', 'HEAD'), ...lines('ls-files', '--others', '--exclude-standard')])].sort();
}

/** Docs to review for a set of changed paths: { docs: Map(doc → [changed paths]), unmapped }. */
function docsFor(root, changed) {
  const docs = new Map();
  const unmapped = [];
  for (const file of changed) {
    const hits = DOCS_MAP.flatMap(({ match, docs: toDocs }) => {
      const m = match.exec(file);
      return m ? toDocs(m) : [];
    })
      .filter((d) => !d.endsWith('?') || fs.existsSync(path.join(root, d.slice(0, -1))))
      .map((d) => d.replace(/\?$/, ''));
    if (hits.length === 0 && !file.endsWith('.md')) unmapped.push(file);
    for (const d of hits) {
      if (!docs.has(d)) docs.set(d, []);
      if (!docs.get(d).includes(file)) docs.get(d).push(file);
    }
  }
  return { docs, unmapped };
}

function main(args) {
  const lines = [];
  const log = (s = '') => lines.push(s);
  if (args.includes('--changed')) {
    const { docs, unmapped } = docsFor(ROOT, changedFiles(ROOT));
    if (docs.size === 0) log('No changed file maps to a doc.');
    else log('Docs to review for your changes:');
    for (const doc of [...docs.keys()].sort()) {
      log(`\n  ${doc}`);
      for (const f of docs.get(doc)) log(`      ${f}`);
    }
    if (unmapped.length) log(`\nChanged, mapped to no doc (add a DOCS_MAP row if one should be):\n${unmapped.map((f) => `      ${f}`).join('\n')}`);
    log();
  }
  const results = runChecks(ROOT);
  let failed = 0;
  for (const { name, problems } of results) {
    log(`${problems.length ? '✗' : '✓'} ${name}`);
    for (const p of problems) log(`    ${p.file}:${p.line}  ${p.message}`);
    failed += problems.length;
  }
  log(failed ? `\ndocs-check: ${failed} problem(s)` : `\ndocs-check: all ${results.length} checks pass`);
  process.stdout.write(`${lines.join('\n')}\n`);
  return failed ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { CHECKS, DOCS_MAP, runChecks, docsFor, context };
