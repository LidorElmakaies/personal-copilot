import { EXAMPLE_PHOTOS } from '../../../../assets/example-photos';
import { monthOf } from '../utils/days';
import { ENTRIES, TODAY } from './entries';
import { STATEMENT, STATEMENT_LINES } from './statement';

// The example data the Phase U screens read, and the Phase L fake API starts from. October 2026 as
// on the canvas (docs/plans/finance/plan.md). Each entry also says which statement line matched it
// (`statementLine: { statementId, lineNo }` or null), the way screen 3 shows it.
export { EXAMPLE_PHOTOS };
export { CATEGORIES } from './categories';
export { TODAY } from './entries';
export {
  PASTE_SAMPLE,
  STATEMENT,
  STATEMENT_ERRORS,
  STATEMENT_LINES,
} from './statement';

export const FINANCE_SETTINGS = {
  cards: [{ cardLast4: '4821', issuer: 'MAX', billingDay: 10 }],
  eveningReminder: { enabled: true, hour: 21, minute: 0 },
};

// The cards used, the last one first (L2.3 keeps them on the phone).
export const CARDS = ['4821', '5520', '1177', '9034', '2468', '7715'];

// An entry's photos: its first attachment, the first example…
export const photosOf = (entry) =>
  entry.attachmentIds.map((id, i) => ({
    ...EXAMPLE_PHOTOS[i % EXAMPLE_PHOTOS.length],
    id,
  }));

// Stands in for the camera (one photo) and the gallery (two) until L5.
let picked = 0;
export const pickExamplePhotos = (source) =>
  Array.from({ length: source === 'camera' ? 1 : 2 }, () => {
    const example = EXAMPLE_PHOTOS[picked % EXAMPLE_PHOTOS.length];
    picked += 1;
    return { ...example, id: `picked-${picked}` };
  });

// The same cards for the monthly check, with the issuer where the settings know it.
export const STATEMENT_CARDS = CARDS.map((last4) => ({
  last4,
  issuer: FINANCE_SETTINGS.cards.find((c) => c.cardLast4 === last4)?.issuer,
}));

// What Choose file… picks until L6.
export const EXAMPLE_STATEMENT_FILE = { name: 'MAX-October-2026.xlsx' };

const lineOf = new Map(
  STATEMENT_LINES.filter((l) => l.entryId).map((l) => [l.entryId, l]),
);

// The month TODAY is in, `{ year, month }`, and a month's entries — only October has any.
export const CURRENT_MONTH = monthOf(TODAY);
export const entriesOfMonth = ({ year, month }) =>
  OCTOBER_ENTRIES.filter((e) =>
    e.occurredOn.startsWith(`${year}-${String(month).padStart(2, '0')}`),
  );

export const OCTOBER_ENTRIES = ENTRIES.map((e) => {
  const l = lineOf.get(e.id);
  return {
    ...e,
    statementLine: l ? { statementId: STATEMENT.id, lineNo: l.lineNo } : null,
  };
});
