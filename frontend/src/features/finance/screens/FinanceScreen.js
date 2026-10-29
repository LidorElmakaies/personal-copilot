import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { monthAt, monthIndex } from '../../../shared/utils/date';
import EntryList from '../components/EntryList';
import FinanceEmpty from '../components/FinanceEmpty';
import FinanceHeader from '../components/FinanceHeader';
import { CATEGORIES, CURRENT_MONTH, entriesOfMonth, TODAY } from '../mocks';

// The Finance tab (Phase U: example data from mocks/). Not behind `requiresAuth`: logged out, the
// tab will show its own notice (B1). No months after the current one.
export default function FinanceScreen() {
  const [index, setIndex] = useState(monthIndex(CURRENT_MONTH));
  const month = monthAt(index);
  const entries = entriesOfMonth(month);

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
          <EntryList entries={entries} categories={CATEGORIES} today={TODAY} />
        )}
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 64,
    paddingBottom: 96,
    gap: 16,
  },
});
