// Sends a user the notification their candle-lighting reminder will send, in N minutes — to check
// delivery end to end (phone locked, app swiped away, …) without waiting for Friday. Plain Node,
// Linux and Windows alike; needs the stack running (docker compose from devops/).
//
//   node scripts/fire-reminder.js <email> [minutes=2]
//
// Same title, body and expiresAt (candle lighting) as the real one, through the real queue and the
// Notification Service. Its own notificationId, so the user's real reminder still fires on time —
// the reminder itself isn't touched. Needs the reminder turned on and a location (it reads
// next_fire_at).
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const COMPOSE = ['compose', '-f', path.join(ROOT, 'devops/docker-compose.yml')];

class Refusal extends Error {}

function exec(service, args, input) {
  const r = spawnSync('docker', [...COMPOSE, 'exec', '-T', service, ...args], {
    input,
    encoding: 'utf8',
  });
  if (r.error || r.status !== 0) {
    throw new Refusal(`docker compose exec ${service} failed (is the stack running?)\n${r.stderr || r.error}`);
  }
  return r.stdout;
}

// The reminder's next firing, one tab-separated row.
function findReminder(email) {
  const sql = `
    SELECT u.id, r.offset_min, (extract(epoch FROM r.next_fire_at) * 1000)::bigint
    FROM users.users u
    JOIN reminders.reminders r ON r.user_id = u.id AND r.type = 'shabbat_candles' AND r.enabled
    WHERE lower(u.email) = lower(:'email') AND r.next_fire_at IS NOT NULL`;
  const out = exec(
    'postgres',
    ['psql', '-U', 'postgres', '-d', 'personal_copilot', '-At', '-F', '\t', '-v', `email=${email}`],
    sql,
  ).trim();
  if (!out)
    throw new Refusal(`No turned-on candle-lighting reminder with a scheduled time for ${email}.`);
  const [userId, offset, nextFireMs] = out.split('\t');
  const candleLighting = new Date(Number(nextFireMs) + Number(offset) * 60_000);
  return { userId, candleLighting };
}

/** Same as the Reminders Service's formatMinutes: 90 → "1 h 30 min". */
function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function main([email, minutesArg = '2']) {
  if (!email) throw new Refusal('usage: node scripts/fire-reminder.js <email> [minutes=2]');
  const minutes = Number(minutesArg);
  if (!(minutes >= 0)) throw new Refusal('minutes must be a number ≥ 0');
  const { userId, candleLighting } = findReminder(email);
  const fireAt = Date.now() + minutes * 60_000;
  if (fireAt >= candleLighting.getTime())
    throw new Refusal('Candle lighting comes before then — nothing to remind about.');

  const at = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' }).format(candleLighting);
  const message = {
    notificationId: `test-reminder-${userId}-${fireAt}`,
    userId,
    title: 'Shabbat candle lighting',
    body: `Candle lighting is at ${at} (in ${formatMinutes(Math.round((candleLighting.getTime() - fireAt) / 60_000))}).`,
    url: '/',
    source: 'fire-reminder',
    requestedAt: new Date().toISOString(),
    expiresAt: candleLighting.toISOString(),
  };
  // notificationRequestedPublishOptions' settings, plus the delay.
  const script = `
    const { Queue } = require('bullmq');
    const m = JSON.parse(process.argv[1]);
    const q = new Queue('notification-requested', { connection: { host: 'redis', port: 6379 } });
    q.add('notification-requested', m, {
      jobId: m.notificationId,
      delay: ${minutes * 60_000},
      deduplication: { id: m.notificationId, ttl: Date.parse(m.expiresAt) - Date.now() },
      attempts: 8, backoff: { type: 'exponential', delay: 30000 },
    }).then(() => q.close());`;
  exec('notifications', ['node', '-e', script, JSON.stringify(message)]);
  console.log(`Queued for ${email} at ${new Date(fireAt).toLocaleTimeString('en-GB')}: "${message.title}" — ${message.body}`);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  if (!(err instanceof Refusal)) throw err;
  console.error(err.message);
  process.exit(1);
}
