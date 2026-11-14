import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import FloatingButton from '../../../shared/components/base/buttons/FloatingButton';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useTranslate } from '../../../shared/i18n/translate';
import { monthAt, monthIndex } from '../../../shared/utils/date';
import CategoryFilterChips from '../components/CategoryFilterChips';
import ConnectionNotice from '../components/ConnectionNotice';
import EntryList from '../components/EntryList';
import FinanceEmpty from '../components/FinanceEmpty';
import FinanceHeader from '../components/FinanceHeader';
import ListToolbar from '../components/ListToolbar';
import QuickAddSheet from '../components/QuickAddSheet';
import ReviewBanner from '../components/ReviewBanner';
import SpentCard from '../components/SpentCard';
import {
  CATEGORIES,
  CURRENT_MONTH,
  entriesOfMonth,
  FINANCE_SETTINGS,
  OCTOBER_ENTRIES,
  STATEMENT,
  STATEMENT_LINES,
  TODAY,
} from '../mocks';
import { filterEntries, NO_FILTER } from '../utils/filter';
import { categoriesBySpending, categoryTotals } from '../utils/spending';
import { statementSummary } from '../utils/statement';

const statement = statementSummary(STATEMENT_LINES);
const card = FINANCE_SETTINGS.cards.find(
  (c) => c.cardLast4 === STATEMENT.cardLast4,
);
const waiting = OCTOBER_ENTRIES.filter((e) => e.notSent).length;

// The Finance tab, screen 1 (Phase U: example data from mocks/): header, the statement's banner
// (on the month it covers, while it has lines to answer), the PC notice, `SpentCard`, the entries,
// the +. Not behind `requiresAuth`: logged out, the tab will show its own notice (B1). No months
// after the current one. `reachable` stands in for the PC link until the outbox (L4). The list's
// search and filters (U4b) are for the month on screen: they clear on another month or leaving the tab.
export default function FinanceScreen({ reachable = true }) {
  const [index, setIndex] = useState(monthIndex(CURRENT_MONTH));
  const month = monthAt(index);
  const entries = entriesOfMonth(month);
  const translate = useTranslate();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState(NO_FILTER);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) setFilter(NO_FILTER);
  }, [focused]);
  const goTo = (i) => {
    setIndex(i);
    setFilter(NO_FILTER);
  };
  const set = (part) => setFilter({ ...filter, ...part });
  const totals = categoryTotals(entries, CATEGORIES);
  const shown = filterEntries(entries, filter);

  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <FinanceHeader
          month={month}
          onPrevious={() => goTo(index - 1)}
          onNext={
            index < monthIndex(CURRENT_MONTH)
              ? () => goTo(index + 1)
              : undefined
          }
        />
        {statement.toAnswer > 0 && monthIndex(statement.month) === index && (
          <ReviewBanner
            month={statement.month}
            toAnswer={statement.toAnswer}
            issuer={card.issuer}
            cardLast4={STATEMENT.cardLast4}
            reported={statement.reported}
            onPress={() => router.push('/finance-review')}
          />
        )}
        <ConnectionNotice reachable={reachable} waiting={waiting} />
        {entries.length === 0 ? (
          <FinanceEmpty />
        ) : (
          <>
            <SpentCard totals={totals} />
            <EntryList
              entries={shown}
              categories={CATEGORIES}
              today={TODAY}
              header={
                <View style={styles.listHeader}>
                  <ListToolbar
                    query={filter.query}
                    onChangeQuery={(query) => set({ query })}
                  />
                  <CategoryFilterChips
                    categories={categoriesBySpending(CATEGORIES, totals)}
                    selectedIds={filter.categoryIds}
                    onChange={(categoryIds) => set({ categoryIds })}
                  />
                </View>
              }
            />
          </>
        )}
      </ScrollView>
      <FloatingButton
        accessibilityLabel={translate('finance.addEntry')}
        testID="add-entry"
        onPress={() => setAdding(true)}
        style={styles.fab}
      />
      <QuickAddSheet visible={adding} onClose={() => setAdding(false)} />
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 64,
    paddingBottom: 96, // the last row scrolls clear of the +
    gap: 16,
  },
  fab: { position: 'absolute', right: 20, bottom: 20 },
  listHeader: { gap: 10, paddingBottom: 4 },
});
