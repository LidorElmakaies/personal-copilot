import { ENTRIES } from './entries';
import { STATEMENT, STATEMENT_LINES } from './statement';

// The example data the Phase U screens read, and the Phase L fake API starts from. October 2026 as
// on the canvas (docs/plans/finance/plan.md). Each entry also says which statement line matched it
// (`statementLine: { statementId, lineNo }` or null), the way screen 3 shows it.
export { CATEGORIES } from './categories';
export { TODAY } from './entries';
export { PASTE_SAMPLE, STATEMENT, STATEMENT_ERRORS, STATEMENT_LINES } from './statement';

export const FINANCE_SETTINGS = {
  cards: [{ cardLast4: '4821', issuer: 'MAX', billingDay: 10 }],
  eveningReminder: { enabled: true, hour: 21, minute: 0 },
};

const lineOf = new Map(
  STATEMENT_LINES.filter((l) => l.entryId).map((l) => [l.entryId, l]),
);

export const OCTOBER_ENTRIES = ENTRIES.map((e) => {
  const l = lineOf.get(e.id);
  return {
    ...e,
    statementLine: l ? { statementId: STATEMENT.id, lineNo: l.lineNo } : null,
  };
});
