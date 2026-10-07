import { StyleSheet, Text, View } from 'react-native';
import GlowCard from '../base/layout/GlowCard';
import { useAppTheme } from '../../hooks/useAppTheme';

const NAMES = {
  gateway: 'Gateway',
  users: 'Users',
  reminders: 'Reminders',
  notifications: 'Notifications',
};
const nameOf = (service) => NAMES[service] ?? service;

const formatBuilt = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

// "1d 4h", "3h 12m", "12m" — from the service's start time to when it was checked.
function formatUptime(startedAt, checkedAt) {
  const minutes = Math.max(
    0,
    Math.floor((Date.parse(checkedAt) - Date.parse(startedAt)) / 60000),
  );
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function downLine(down) {
  if (!down.length) return 'Every service is answering';
  const names = down.map((s) => nameOf(s.service));
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${list} ${names.length === 1 ? "isn't" : "aren't"} answering`;
}

// Mockup A2 (docs/plans/shabbat-reminders-calendar/mockups.html): an "N/M up" summary, then one
// row per service from GET /admin/status.
export default function SystemStatus({ services, checkedAt }) {
  const { colors } = useAppTheme();
  const down = services.filter((s) => s.status !== 'up');
  const summaryColor = down.length ? colors.error : colors.success;

  return (
    <>
      <GlowCard>
        <View style={styles.summary}>
          <Text
            style={[styles.count, { color: summaryColor }]}
            accessibilityLabel={`${services.length - down.length} of ${services.length} services up`}
          >
            {services.length - down.length}/{services.length}
          </Text>
          <View style={styles.summaryText}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              services up
            </Text>
            <Text style={[styles.small, { color: colors.textMuted }]}>
              {downLine(down)}
            </Text>
          </View>
        </View>
      </GlowCard>
      <GlowCard>
        {services.map((s, i) => {
          const up = s.status === 'up';
          const tint = up ? colors.success : colors.error;
          const details = up
            ? [
                s.builtAt ? `built ${formatBuilt(s.builtAt)}` : null,
                s.startedAt
                  ? `up ${formatUptime(s.startedAt, checkedAt)}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'no answer';
          return (
            <View
              key={s.service}
              style={[
                styles.row,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.cardBorder,
                },
              ]}
              accessibilityLabel={`${nameOf(s.service)} ${up ? 'up' : 'down'}`}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: tint, shadowColor: tint },
                ]}
              />
              <View style={styles.rowMain}>
                <Text style={[styles.name, { color: up ? colors.text : tint }]}>
                  {nameOf(s.service)}
                </Text>
                <Text style={[styles.mono, { color: colors.textFaint }]}>
                  {details}
                </Text>
              </View>
              <View style={styles.rowEnd}>
                <Text
                  style={[styles.version, { color: up ? colors.text : tint }]}
                >
                  {up ? (s.version ?? '—') : 'down'}
                </Text>
                {up && s.latencyMs !== null ? (
                  <Text style={[styles.small, { color: colors.textFaint }]}>
                    {s.latencyMs} ms
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </GlowCard>
    </>
  );
}

const MONO = { fontFamily: 'monospace', fontVariant: ['tabular-nums'] };

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  count: { ...MONO, fontSize: 30, fontWeight: '700' },
  summaryText: { flex: 1, gap: 2 },
  summaryTitle: { fontSize: 15, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  rowMain: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600' },
  rowEnd: { alignItems: 'flex-end', gap: 2 },
  version: { ...MONO, fontSize: 14, fontWeight: '700' },
  mono: { ...MONO, fontSize: 11 },
  small: { fontSize: 12 },
});
