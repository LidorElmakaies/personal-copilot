import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { dayLabel } from '../utils/format';
import EntryRow from './EntryRow';

// A month's entries in a panel card (screen 1), newest first, under day headings (TODAY,
// YESTERDAY, OCT 25 — relative to `today`, YYYY-MM-DD). `onPressEntry(entry)`.
export default function EntryList({
  entries,
  categories,
  today,
  onPressEntry,
}) {
  const { colors } = useAppTheme();
  const nameOf = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const newestFirst = [...entries].sort((a, b) =>
    b.occurredOn.localeCompare(a.occurredOn),
  );

  return (
    <GlowCard>
      {newestFirst.map((entry, i) => {
        const newDay = entry.occurredOn !== newestFirst[i - 1]?.occurredOn;
        return (
          <Fragment key={entry.id}>
            {newDay && (
              <Text style={[styles.day, { color: colors.textMuted }]}>
                {dayLabel(entry.occurredOn, today)}
              </Text>
            )}
            {!newDay && (
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.cardBorderSoft },
                ]}
              />
            )}
            <EntryRow
              entry={entry}
              category={nameOf[entry.categoryId]}
              onPress={onPressEntry && (() => onPressEntry(entry))}
            />
          </Fragment>
        );
      })}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  day: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: 10,
  },
  divider: { height: StyleSheet.hairlineWidth },
});
