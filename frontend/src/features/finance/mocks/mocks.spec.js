import {
  CATEGORIES,
  OCTOBER_ENTRIES,
  STATEMENT,
  STATEMENT_LINES,
  TODAY,
} from '.';

// The example month must keep showing what the canvas shows (screens 1, 3, 5, 6 and 8).

const sum = (rows) => rows.reduce((total, r) => total + r.amountAgorot, 0);
const nameOf = (id) => CATEGORIES.find((c) => c.id === id).name;

describe('October 2026 example data', () => {
  it('spends ₪7,840 in 7 categories, Housing, Groceries and Eating out on top (screen 1)', () => {
    expect(sum(OCTOBER_ENTRIES)).toBe(784000);
    const byCategory = {};
    for (const e of OCTOBER_ENTRIES) {
      const name = nameOf(e.categoryId);
      byCategory[name] = (byCategory[name] ?? 0) + e.amountAgorot;
    }
    const ranked = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    expect(ranked).toHaveLength(7);
    expect(ranked.slice(0, 3)).toEqual([
      ['Housing', 320000],
      ['Groceries', 186000],
      ['Eating out', 64000],
    ]);
  });

  it("lists today's two entries and Oct 25's fuel as on screen 1", () => {
    const today = OCTOBER_ENTRIES.filter((e) => e.occurredOn === TODAY);
    expect(today.map((e) => [e.description, e.amountAgorot, e.paidWith])).toEqual([
      ['Dinner with Dana', 15000, 'bit'],
      ['Weekly groceries', 28490, 'card'],
    ]);
    expect(today[0].notSent).toBe(true);
    expect(today[1].attachmentIds).toHaveLength(2);
    expect(today[1].statementLine).toMatchObject({ statementId: STATEMENT.id });
    const fuel = OCTOBER_ENTRIES.find((e) => e.occurredOn === '2026-10-25');
    expect([fuel.description, fuel.amountAgorot, fuel.cardLast4]).toEqual(['Fuel', 31000, '4821']);
  });

  it('has 42 lines adding up to the ₪7,840 total: 36 matched, 6 to answer (screens 5, 6, 8)', () => {
    expect(STATEMENT_LINES).toHaveLength(42);
    expect(sum(STATEMENT_LINES)).toBe(STATEMENT.declaredTotalAgorot);
    expect(STATEMENT.declaredTotalAgorot).toBe(784000);
    const matched = STATEMENT_LINES.filter((l) => l.matchStatus === 'auto_matched');
    expect(matched).toHaveLength(36);
    expect(STATEMENT_LINES.filter((l) => l.matchStatus === 'suggested')).toHaveLength(1);
    expect(STATEMENT_LINES.filter((l) => l.matchStatus === 'unmatched')).toHaveLength(5);
    expect(STATEMENT_LINES.map((l) => l.lineNo)).toEqual(
      Array.from({ length: 42 }, (_, i) => i + 1),
    );
  });

  it("matches each line to its own card entry of the same amount and day", () => {
    const entryOf = new Map(OCTOBER_ENTRIES.map((e) => [e.id, e]));
    const matched = STATEMENT_LINES.filter((l) => l.entryId);
    expect(new Set(matched.map((l) => l.entryId)).size).toBe(matched.length);
    for (const l of matched) {
      const e = entryOf.get(l.entryId);
      expect([e.amountAgorot, e.occurredOn, e.cardLast4]).toEqual([
        l.amountAgorot,
        l.occurredOn,
        '4821',
      ]);
    }
  });

  it('asks about BIT ₪150 on Oct 12: Dinner with Dana first, then Pizza with the team', () => {
    const question = STATEMENT_LINES.find((l) => l.matchStatus === 'suggested');
    expect([question.merchantRaw, question.amountAgorot, question.occurredOn]).toEqual([
      'BIT',
      15000,
      '2026-10-12',
    ]);
    const candidates = question.suggestion.candidateEntryIds.map(
      (id) => OCTOBER_ENTRIES.find((e) => e.id === id).description,
    );
    expect(candidates).toEqual(['Dinner with Dana', 'Pizza with the team']);
  });

  it('lists the 5 not-reported charges as on screen 6', () => {
    const rows = STATEMENT_LINES.filter((l) => l.matchStatus === 'unmatched').map((l) => [
      l.occurredOn.slice(-2),
      l.merchantRaw,
      l.amountAgorot,
      l.suggestion ? nameOf(l.suggestion.categoryId) : null,
    ]);
    expect(rows).toEqual([
      ['03', 'שופרסל דיל', 41230, 'Groceries'],
      ['09', 'BIT', 8000, null],
      ['11', 'NETFLIX.COM', 4990, 'Subscriptions'],
      ['17', 'KSP', 30000, null],
      ['22', 'AMAZON', 9310, 'Shopping'],
    ]);
    const ksp = STATEMENT_LINES.find((l) => l.merchantRaw === 'KSP');
    expect([ksp.installmentNo, ksp.installmentsTotal]).toEqual([1, 12]);
    const amazon = STATEMENT_LINES.find((l) => l.merchantRaw === 'AMAZON');
    expect([amazon.originalCurrency, amazon.originalAmount]).toEqual(['USD', 2499]);
  });

  it('keeps every entry in October, by today, off Shabbat, in a known category', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id));
    for (const e of OCTOBER_ENTRIES) {
      expect(e.occurredOn >= '2026-10-01' && e.occurredOn <= TODAY).toBe(true);
      expect(new Date(`${e.occurredOn}T12:00:00Z`).getUTCDay()).not.toBe(6);
      expect(ids.has(e.categoryId)).toBe(true);
    }
  });
});
