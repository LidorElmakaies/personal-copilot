// SPIKE (R1.1) — runs runChecks.ts in Node, to compare the copied lib with Gateway before the phone.
// From frontend/: node --experimental-transform-types --no-warnings src/spike/nodeCheck.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// The lib's imports are extensionless ('./models/civil-date'); Node's ESM resolver needs '.ts'.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    if (spec.startsWith('.') && !spec.endsWith('.ts')) return next(spec + '.ts', ctx);
    throw e;
  }
}`),
);

const { runChecks, runtimeProbes } = await import('./runChecks.ts');
const expected = JSON.parse(readFileSync(new URL('./expected.json', import.meta.url), 'utf8'));
let failed = 0;
for (const r of [...runtimeProbes(), ...runChecks(expected)]) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name} (${r.ms.toFixed(1)} ms) — ${r.detail}`);
}
process.exit(failed ? 1 : 0);
