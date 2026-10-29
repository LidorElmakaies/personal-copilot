import { ENTRIES } from './entries';

// October 2026's example MAX ••4821 statement, in the API's shape (README §5; money in whole
// agorot): 42 lines, ₪7,840. 36 are the entries with a `merchant`, auto-matched; 6 are to answer —
// screen 6 of the canvas: one "Is this yours?" (BIT ₪150 on Oct 12: Dinner with Dana, or Pizza with
// the team) and 5 not reported. Lines are numbered by date.
export const STATEMENT_ID = 'statement-2026-10-4821';

const byDescription = (description, occurredOn) =>
  ENTRIES.find((e) => e.description === description && e.occurredOn === occurredOn).id;

const line = (occurredOn, merchantRaw, amountAgorot, own = {}) => ({
  statementId: STATEMENT_ID,
  occurredOn,
  merchantRaw,
  amountAgorot,
  originalCurrency: null,
  originalAmount: null,
  installmentNo: null,
  installmentsTotal: null,
  matchStatus: 'unmatched',
  entryId: null,
  suggestion: null,
  ...own,
});

const matched = ENTRIES.filter((e) => e.merchant).map((e) =>
  line(e.occurredOn, e.merchant, e.amountAgorot, {
    matchStatus: 'auto_matched',
    entryId: e.id,
  }),
);

const toAnswer = [
  line('2026-10-12', 'BIT', 15000, {
    matchStatus: 'suggested',
    suggestion: {
      candidateEntryIds: [
        byDescription('Dinner with Dana', '2026-10-12'),
        byDescription('Pizza with the team', '2026-10-14'),
      ],
      categoryId: null,
      reason: 'Two Bit entries of ₪150 within 3 days',
    },
  }),
  line('2026-10-03', 'שופרסל דיל', 41230, {
    suggestion: { candidateEntryIds: [], categoryId: 'cat-groceries', reason: 'history' },
  }),
  line('2026-10-09', 'BIT', 8000),
  line('2026-10-11', 'NETFLIX.COM', 4990, {
    suggestion: { candidateEntryIds: [], categoryId: 'cat-subscriptions', reason: 'llm' },
  }),
  line('2026-10-17', 'KSP', 30000, { installmentNo: 1, installmentsTotal: 12 }),
  line('2026-10-22', 'AMAZON', 9310, {
    originalCurrency: 'USD',
    originalAmount: 2499,
    suggestion: { candidateEntryIds: [], categoryId: 'cat-shopping', reason: 'llm' },
  }),
];

export const STATEMENT_LINES = [...matched, ...toAnswer]
  .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
  .map((l, i) => ({ id: `line-${String(i + 1).padStart(2, '0')}`, lineNo: i + 1, ...l }));

export const STATEMENT = {
  id: STATEMENT_ID,
  cardLast4: '4821',
  chargeDate: '2026-11-10',
  source: 'xlsx',
  declaredTotalAgorot: 784000,
  status: 'needs_review',
  error: null,
  createdAt: '2026-10-27T18:40:00.000Z',
};

// A statement's `error` when it's `failed` — screen 5's cards (U10). The words are the
// component's; these are the facts each one shows.
export const STATEMENT_ERRORS = {
  totalsMismatch: {
    code: 'totals_mismatch',
    rowsTotalAgorot: 761200,
    declaredTotalAgorot: 784000,
  },
  notMaxFile: { code: 'not_max_file' },
  llmUnreachable: { code: 'llm_unreachable', attempts: 3 },
  unknown: { code: 'unknown' },
};

// Screen 4's paste box, as the canvas shows it.
export const PASTE_SAMPLE = [
  '13/10/26  שופרסל דיל      284.90',
  '14/10/26  BIT             150.00',
  '15/10/26  פז תחנת דלק    310.00',
  '…',
].join('\n');
