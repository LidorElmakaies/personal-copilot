// How much of the biggest category's bar a category fills: 0–1 (`SpentCard`'s `CategoryBar`s).
export const barShare = (agorot, biggestAgorot) =>
  biggestAgorot > 0 ? Math.min(Math.max(agorot / biggestAgorot, 0), 1) : 0;

// A month's spending by category, biggest first (ties by the categories' order), only those with
// any: `[{ id, name, amountAgorot }]`. An entry in several counts in full in each, so together they can
// be more than `spentAgorot`. Income entries don't count.
export function categoryTotals(entries, categories) {
  const sums = new Map();
  for (const e of entries) {
    if (e.direction !== 'expense') continue;
    for (const id of e.categoryIds) {
      sums.set(id, (sums.get(id) ?? 0) + e.amountAgorot);
    }
  }
  return categories
    .filter((c) => sums.get(c.id) > 0)
    .map((c) => ({ id: c.id, name: c.name, amountAgorot: sums.get(c.id) }))
    .sort((a, b) => b.amountAgorot - a.amountAgorot);
}

// The month's spending: each expense once, however many categories it's in.
export const spentAgorot = (entries) =>
  entries
    .filter((e) => e.direction === 'expense')
    .reduce((sum, e) => sum + e.amountAgorot, 0);

// Every category for the list's chips: those spent on this month first, biggest first, then the rest
// in the categories' own order. Archived ones are left out.
export function categoriesBySpending(categories, totals) {
  const rank = new Map(totals.map((t, i) => [t.id, i]));
  return categories
    .filter((c) => !c.archivedAt)
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) =>
        (rank.get(a.c.id) ?? totals.length + a.i) -
        (rank.get(b.c.id) ?? totals.length + b.i),
    )
    .map(({ c }) => c);
}
