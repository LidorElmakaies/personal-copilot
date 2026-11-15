// The list's search, filters and sort (U4b, screens 11–15). Pure: the screen keeps the choices, these
// pick and order the month's entries.

// No filter on: everything, newest first.
export const NO_FILTER = {
  query: '',
  categoryIds: [],
  minAgorot: null,
  maxAgorot: null,
  paidWith: [],
};

const normalize = (text) =>
  (text ?? '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

// Entries matching every filter that's on: `query` in "what for" or the shop (either language,
// case and extra spaces ignored), any of `categoryIds`, `minAgorot`–`maxAgorot` (inclusive; null = no
// bound), any of `paidWith`. An empty list or a blank query filters nothing.
export function filterEntries(entries, filter) {
  const { query, categoryIds, minAgorot, maxAgorot, paidWith } = {
    ...NO_FILTER,
    ...filter,
  };
  const q = normalize(query);
  return entries.filter(
    (e) =>
      (!q ||
        normalize(e.description).includes(q) ||
        normalize(e.merchant).includes(q)) &&
      (categoryIds.length === 0 || categoryIds.includes(e.categoryId)) &&
      (minAgorot == null || e.amountAgorot >= minAgorot) &&
      (maxAgorot == null || e.amountAgorot <= maxAgorot) &&
      (paidWith.length === 0 || paidWith.includes(e.paidWith)),
  );
}

// How an entry can be paid, in the filter sheet's order.
export const PAID_WITH = ['card', 'bit', 'paybox', 'cash', 'transfer'];

export const SORTS = ['newest', 'oldest', 'highest', 'lowest'];
export const DEFAULT_SORT = 'newest';

const byDate = (a, b) => a.occurredOn.localeCompare(b.occurredOn);
const byAmount = (a, b) => a.amountAgorot - b.amountAgorot;
const COMPARE = {
  newest: (a, b) => byDate(b, a),
  oldest: byDate,
  highest: (a, b) => byAmount(b, a) || byDate(b, a),
  lowest: (a, b) => byAmount(a, b) || byDate(b, a),
};

// A sorted copy: by day (`newest`, `oldest`) or by amount (`highest`, `lowest`, ties newest first).
// Same-day entries keep their order.
export const sortEntries = (entries, sort = DEFAULT_SORT) =>
  [...entries].sort(COMPARE[sort]);

// Sorted by amount, the list drops its day headings (screen 12).
export const isByAmount = (sort) => sort === 'highest' || sort === 'lowest';

// Whether anything differs from the default — the summary line and Clear show only then.
export const isFiltering = (filter, sort = DEFAULT_SORT) =>
  sort !== DEFAULT_SORT ||
  normalize(filter.query) !== '' ||
  filter.categoryIds.length > 0 ||
  filter.minAgorot != null ||
  filter.maxAgorot != null ||
  filter.paidWith.length > 0;

// Whether the filter sheet holds something the toolbar doesn't show — more than one category, an
// amount, how it was paid: the all-filters button is lit then (one category is the chips').
export const sheetFiltering = (filter) =>
  filter.categoryIds.length > 1 ||
  filter.minAgorot != null ||
  filter.maxAgorot != null ||
  filter.paidWith.length > 0;
