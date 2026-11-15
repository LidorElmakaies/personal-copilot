import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import { usePlainInHebrew, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { DEFAULT_SORT, isByAmount, sortEntries } from '../utils/filter';
import { dayLabel } from '../utils/format';
import EntryRow from './EntryRow';

// A month's entries in a panel card (screen 1) in `sort`'s order (filter.js's SORTS, newest first by
// default). By day, under day headings (TODAY, YESTERDAY, OCT 25 — relative to `today`, YYYY-MM-DD);
// by amount, one flat list with the day leading each row's second line (screen 12).
// `onPressEntry(entry)`; `header` sits on top inside the card (the toolbar, chips and summary, U4b).
export default function EntryList({
  entries,
  categories,
  today,
  sort = DEFAULT_SORT,
  onPressEntry,
  header,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const nameOf = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const sorted = sortEntries(entries, sort);
  const flat = isByAmount(sort);

  return (
    <GlowCard>
      {header}
      {sorted.map((entry, i) => {
        const heading = !flat && entry.occurredOn !== sorted[i - 1]?.occurredOn;
        return (
          <Fragment key={entry.id}>
            {heading && (
              <Text style={[styles.day, plain, { color: colors.textMuted }]}>
                {dayLabel(translate, entry.occurredOn, today)}
              </Text>
            )}
            {!heading && i > 0 && (
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
              day={
                flat ? dayLabel(translate, entry.occurredOn, today) : undefined
              }
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
