import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import FloatingButton from '../../../shared/components/base/buttons/FloatingButton';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useTranslate } from '../../../shared/i18n/translate';
import { monthAt, monthIndex } from '../../../shared/utils/date';
import ConnectionNotice from '../components/ConnectionNotice';
import EntryList from '../components/EntryList';
import FinanceEmpty from '../components/FinanceEmpty';
import FinanceHeader from '../components/FinanceHeader';
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
import { categoryTotals } from '../utils/spending';
import { statementSummary } from '../utils/statement';

const statement = statementSummary(STATEMENT_LINES);
const card = FINANCE_SETTINGS.cards.find(
  (c) => c.cardLast4 === STATEMENT.cardLast4,
);
const waiting = OCTOBER_ENTRIES.filter((e) => e.notSent).length;

// The Finance tab, screen 1 (Phase U: example data from mocks/): header, the statement's banner
// (on the month it covers, while it has lines to answer), the PC notice, `SpentCard`, the entries,
// the +. Not behind `requiresAuth`: logged out, the tab will show its own notice (B1). No months
// after the current one. `reachable` stands in for the PC link until the outbox (L4).
export default function FinanceScreen({ reachable = true }) {
  const [index, setIndex] = useState(monthIndex(CURRENT_MONTH));
  const month = monthAt(index);
  const entries = entriesOfMonth(month);
  const translate = useTranslate();
  const [adding, setAdding] = useState(false);

  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <FinanceHeader
          month={month}
          onPrevious={() => setIndex(index - 1)}
          onNext={
            index < monthIndex(CURRENT_MONTH)
              ? () => setIndex(index + 1)
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
            <SpentCard totals={categoryTotals(entries, CATEGORIES)} />
            <EntryList
              entries={entries}
              categories={CATEGORIES}
              today={TODAY}
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
});
