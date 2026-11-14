import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import FloatingButton from '../../../shared/components/base/buttons/FloatingButton';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useTranslate } from '../../../shared/i18n/translate';
import { monthAt, monthIndex } from '../../../shared/utils/date';
import EntryList from '../components/EntryList';
import FinanceEmpty from '../components/FinanceEmpty';
import FinanceHeader from '../components/FinanceHeader';
import QuickAddSheet from '../components/QuickAddSheet';
import SpentCard from '../components/SpentCard';
import { CATEGORIES, CURRENT_MONTH, entriesOfMonth, TODAY } from '../mocks';
import { categoryTotals } from '../utils/spending';

// The Finance tab (Phase U: example data from mocks/). Not behind `requiresAuth`: logged out, the
// tab will show its own notice (B1). No months after the current one.
export default function FinanceScreen() {
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
