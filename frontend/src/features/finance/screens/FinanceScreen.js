import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import FloatingButton from '../../../shared/components/base/buttons/FloatingButton';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useTranslate } from '../../../shared/i18n/translate';
import { monthAt, monthIndex } from '../../../shared/utils/date';
import CategoryFilterChips from '../components/CategoryFilterChips';
import ConnectionNotice from '../components/ConnectionNotice';
import EntryList from '../components/EntryList';
import FilterSheet from '../components/FilterSheet';
import FilterSummary from '../components/FilterSummary';
import FinanceEmpty from '../components/FinanceEmpty';
import FinanceHeader from '../components/FinanceHeader';
import ListToolbar from '../components/ListToolbar';
import NewCategorySheet from '../components/NewCategorySheet';
import NoMatch from '../components/NoMatch';
import QuickAddSheet from '../components/QuickAddSheet';
import ReviewBanner from '../components/ReviewBanner';
import SpentCard from '../components/SpentCard';
import {
  CARDS,
  CATEGORIES,
  CURRENT_MONTH,
  entriesOfMonth,
  FINANCE_SETTINGS,
  OCTOBER_ENTRIES,
  STATEMENT,
  STATEMENT_LINES,
  TODAY,
} from '../mocks';
import { addCategory } from '../utils/categories';
import {
  DEFAULT_SORT,
  filterEntries,
  isByAmount,
  isFiltering,
  NO_FILTER,
  sheetFiltering,
} from '../utils/filter';
import {
  categoriesBySpending,
  categoryTotals,
  spentAgorot,
} from '../utils/spending';
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
// search, filters and sort (U4b) are for the month on screen: they clear on another month or leaving
// the tab. The sort button flips between by day and by amount; the filter sheet has every option.
// A new category (U4b.6) joins the list in memory (L2.5 saves it) and is chosen in the filter it was
// added from: the chips' "+ New" filters to it, the sheet's "+ New category" picks it in the sheet.
export default function FinanceScreen({ reachable = true }) {
  const [index, setIndex] = useState(monthIndex(CURRENT_MONTH));
  const month = monthAt(index);
  const entries = entriesOfMonth(month);
  const translate = useTranslate();
  const [adding, setAdding] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [categories, setCategories] = useState(CATEGORIES);
  const [naming, setNaming] = useState(false);
  // Who opened the new-category sheet: chooses the category once added.
  const selectNew = useRef(null);
  const newCategory = (select) => {
    selectNew.current = select;
    setNaming(true);
  };
  const [filter, setFilter] = useState(NO_FILTER);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const clear = () => {
    setFilter(NO_FILTER);
    setSort(DEFAULT_SORT);
  };
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) clear();
  }, [focused]);
  const goTo = (i) => {
    setIndex(i);
    clear();
  };
  const set = (part) => setFilter({ ...filter, ...part });
  const totals = categoryTotals(entries, categories);
  const shown = filterEntries(entries, filter);
  const ordered = categoriesBySpending(categories, totals);

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
            <SpentCard spent={spentAgorot(entries)} totals={totals} />
            <EntryList
              entries={shown}
              categories={categories}
              today={TODAY}
              sort={sort}
              empty={
                <NoMatch
                  filter={filter}
                  month={month}
                  categories={categories}
                  onSearchAllCategories={() => set({ categoryIds: [] })}
                />
              }
              header={
                <View style={styles.listHeader}>
                  <ListToolbar
                    query={filter.query}
                    onChangeQuery={(query) => set({ query })}
                    sort={sort}
                    onSort={() =>
                      setSort(isByAmount(sort) ? DEFAULT_SORT : 'highest')
                    }
                    onFilters={() => setFiltering(true)}
                    filtersActive={sheetFiltering(filter)}
                  />
                  <CategoryFilterChips
                    categories={ordered}
                    selectedIds={filter.categoryIds}
                    onChange={(categoryIds) => set({ categoryIds })}
                    onNewCategory={() =>
                      newCategory((id) => set({ categoryIds: [id] }))
                    }
                  />
                  {isFiltering(filter, sort) && (
                    <FilterSummary
                      filter={filter}
                      sort={sort}
                      entries={shown}
                      categories={categories}
                      onClear={clear}
                    />
                  )}
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
      <QuickAddSheet
        visible={adding}
        onClose={() => setAdding(false)}
        categories={ordered}
        cards={CARDS}
      />
      <FilterSheet
        visible={filtering}
        onClose={() => setFiltering(false)}
        filter={filter}
        sort={sort}
        entries={entries}
        categories={ordered}
        onNewCategory={newCategory}
        onApply={(chosen) => {
          setFilter(chosen.filter);
          setSort(chosen.sort);
          setFiltering(false);
        }}
      />
      <NewCategorySheet
        visible={naming}
        onClose={() => setNaming(false)}
        categories={categories}
        onAdd={(fields) => {
          const added = addCategory(categories, fields);
          setCategories(added.categories);
          selectNew.current?.(added.category.id);
          setNaming(false);
        }}
      />
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
