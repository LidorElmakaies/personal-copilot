import { StyleSheet, Text, View } from 'react-native';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import { count, dayMonth, duration } from '../../../shared/i18n/format';
import { useLanguage, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { formatTime } from '../../../shared/utils/time';

// The services' own names, the same in both languages.
const NAMES = {
  gateway: 'Gateway',
  users: 'Users',
  reminders: 'Reminders',
  notifications: 'Notifications',
};
const nameOf = (service) => NAMES[service] ?? service;

// "1d 4h", "3h 12m", "12m" · "יום ו־4 שעות" — from the service's start time to when it was checked.
function formatUptime(translate, startedAt, checkedAt) {
  const minutes = Math.max(
    0,
    Math.floor((Date.parse(checkedAt) - Date.parse(startedAt)) / 60000),
  );
  const d = Math.floor(minutes / 1440);
  if (!d) {
    return (
      duration(translate, minutes) || translate('duration.minutes', { n: 0 })
    );
  }
  const days = count(translate, 'count.days', d);
  const hours = Math.floor((minutes % 1440) / 60);
  return hours
    ? translate('duration.both', {
        hours: days,
        minutes: duration(translate, hours * 60),
      })
    : days;
}

function downLine(translate, down) {
  if (!down.length) return translate('admin.allUp');
  const names = down.map((s) => nameOf(s.service));
  if (names.length === 1) return translate('admin.oneDown', { name: names[0] });
  const list = translate('admin.and', {
    list: names.slice(0, -1).join(', '),
    last: names.at(-1),
  });
  return translate('admin.manyDown', { names: list });
}

// Mockup A2: an "N/M up" summary, then one
// row per service from GET /admin/status.
export default function SystemStatus({ services, checkedAt }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  // Android's monospace has no Hebrew letters: its fallback spaces them out. English only.
  const mono = useLanguage() === 'en' ? MONO : null;
  const down = services.filter((s) => s.status !== 'up');
  const upCount = services.length - down.length;
  const summaryColor = down.length ? colors.error : colors.success;

  return (
    <>
      <GlowCard>
        <View style={styles.summary}>
          <Text
            style={[styles.count, { color: summaryColor }]}
            accessibilityLabel={translate('admin.upOf', {
              up: upCount,
              total: services.length,
            })}
          >
            {upCount}/{services.length}
          </Text>
          <View style={styles.summaryText}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              {translate('admin.servicesUp')}
            </Text>
            <Text style={[styles.small, { color: colors.textMuted }]}>
              {downLine(translate, down)}
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
                s.builtAt
                  ? translate('admin.built', {
                      date: dayMonth(translate, new Date(s.builtAt)),
                      time: formatTime(new Date(s.builtAt)),
                    })
                  : null,
                s.startedAt
                  ? translate('admin.uptime', {
                      time: formatUptime(translate, s.startedAt, checkedAt),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : translate('admin.noAnswer');
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
              accessibilityLabel={translate(
                up ? 'admin.rowUp' : 'admin.rowDown',
                {
                  name: nameOf(s.service),
                },
              )}
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
                <Text
                  style={[styles.details, mono, { color: colors.textFaint }]}
                >
                  {details}
                </Text>
              </View>
              <View style={styles.rowEnd}>
                <Text
                  style={[
                    styles.version,
                    up && MONO,
                    { color: up ? colors.text : tint },
                  ]}
                >
                  {up ? (s.version ?? '—') : translate('admin.down')}
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
  version: { fontSize: 14, fontWeight: '700' },
  details: { fontSize: 11 },
  small: { fontSize: 12 },
});
