import { count, dayMonth } from '../../../shared/i18n/format';
import {
  bold,
  boldParts,
  formatShekels,
  isolate,
  parseShekels,
} from './format';

// What `ReviewBanner` says about a statement's lines (README §5's match_status): still to answer
// (`unmatched`, `suggested`), already reported (an entry matched it: `auto_matched`, `confirmed`),
// and the month it covers — its latest line's, `{ year, month }`. Answered and ignored lines are
// neither. `null` month for no lines.
const TO_ANSWER = new Set(['unmatched', 'suggested']);
const REPORTED = new Set(['auto_matched', 'confirmed']);

export function statementSummary(lines) {
  const latest = lines.reduce(
    (max, l) => (l.occurredOn > max ? l.occurredOn : max),
    '',
  );
  return {
    toAnswer: lines.filter((l) => TO_ANSWER.has(l.matchStatus)).length,
    reported: lines.filter((l) => REPORTED.has(l.matchStatus)).length,
    month: latest
      ? { year: Number(latest.slice(0, 4)), month: Number(latest.slice(5, 7)) }
      : null,
  };
}

// "Yes, that's my entry": the line is reported, and the entry is no other line's candidate — one left with
// none is simply not reported.
export const confirmLine = (lines, id, entryId) =>
  lines.map((l) => {
    if (l.id === id) {
      return { ...l, matchStatus: 'confirmed', entryId, suggestion: null };
    }
    const ids = l.suggestion?.candidateEntryIds;
    if (!ids?.includes(entryId)) return l;
    const left = ids.filter((c) => c !== entryId);
    return left.length
      ? { ...l, suggestion: { ...l.suggestion, candidateEntryIds: left } }
      : unreported(l);
  });

// "Neither": the line isn't reported.
export const rejectLine = (lines, id) =>
  lines.map((l) => (l.id === id ? unreported(l) : l));

// An answered line: an entry was made of it.
export const answerLine = (lines, id) =>
  lines.map((l) => (l.id === id ? { ...l, matchStatus: 'answered' } : l));

// The entry a charge becomes, but for what it was for and its category: how it was paid from the shop
// (README §4), else the statement's card; a refund (a negative line) is one.
export function chargeEntry(line, cardLast4) {
  const shop = line.merchantRaw.trim();
  const paidWith = /^(bit|ביט)(\s|$)/i.test(shop)
    ? 'bit'
    : /^paybox(\s|$)/i.test(shop)
      ? 'paybox'
      : 'card';
  return {
    amountAgorot: Math.abs(line.amountAgorot),
    direction: line.amountAgorot < 0 ? 'refund' : 'expense',
    paidWith,
    cardLast4: paidWith === 'card' ? cardLast4 : null,
    occurredOn: line.occurredOn,
  };
}

const unreported = (line) => ({
  ...line,
  matchStatus: 'unmatched',
  suggestion: null,
});

// What `MonthClosed` says of a statement with nothing left to answer: its charges and their total (refunds
// taken off), how many were reported during the month, and how many answered here (a Yes or an answer).
const ANSWERED = new Set(['confirmed', 'answered']);
export const closedSummary = (lines) => ({
  charges: lines.length,
  totalAgorot: lines.reduce((sum, l) => sum + l.amountAgorot, 0),
  reported: lines.filter((l) => l.matchStatus === 'auto_matched').length,
  answered: lines.filter((l) => ANSWERED.has(l.matchStatus)).length,
});

// Why a statement can't be checked yet — a dictionary key — or null: no card, no file, or no text or
// total (as typed; ₪0 is one: a month of refunds can come to it).
export function statementProblem({ card, source, file, text, total }) {
  if (!card) return 'statement.cardRequired';
  if (source === 'file') return file ? null : 'statement.fileRequired';
  if (!text.trim()) return 'statement.textRequired';
  return parseShekels(total) === null ? 'statement.totalRequired' : null;
}

// Screen 5's steps, each `done`, `active` or `waiting`, from the statement's status (README §5's).
// A statement with a status has been received, so the first is always done.
const STEPS = ['received', 'parsing', 'matching'];
const ALL_DONE = new Set(['needs_review', 'closed']);

export function statementSteps(status) {
  const at = ALL_DONE.has(status)
    ? STEPS.length
    : Math.max(1, STEPS.indexOf(status));
  return STEPS.map((step, i) => ({
    step,
    state: i < at ? 'done' : i === at ? 'active' : 'waiting',
  }));
}

// What `StatementError` says: its title, its text in `parts` (the amounts `bold`), its button, and
// whether reading the kept statement again can help (`retry`). A code it doesn't know reads as unknown.
export function statementErrorText(translate, error, source) {
  const say = (name, text, vars, action = 'startOver') => ({
    retry: error?.code === 'llm_unreachable',
    title: translate(`statementError.${name}`),
    parts: boldParts(translate(`statementError.${text}`, vars)),
    action: translate(`statementError.${action}`),
  });
  const amount = (agorot) => bold(formatShekels(agorot));
  switch (error?.code) {
    case 'totals_mismatch':
      return say('totals', source === 'text' ? 'totalsText' : 'totalsFile', {
        rows: amount(error.rowsTotalAgorot),
        declared: amount(error.declaredTotalAgorot),
      });
    case 'not_max_file':
      return say('notMax', 'notMaxText', {}, 'chooseAnother');
    case 'llm_unreachable':
      return say('llm', 'llmText', {
        tried: count(translate, 'count.tried', error.attempts),
      });
    default:
      return say('unknown', 'unknownText');
  }
}

// `MatchQuestion`'s sentence, in parts, the `shown` entry's "what for" bold: "Two of your entries match.
// Most likely: Dinner with Dana (Oct 12)." — past the first, "Or: …".
export function matchText(translate, candidates, shown) {
  const { description, occurredOn } = candidates[shown];
  const vars = {
    n: candidates.length,
    entry: bold(isolate(description)),
    day: dayMonth(translate, occurredOn),
  };
  if (shown > 0) return boldParts(translate('match.or', vars));
  const many = ['one', 'two'][candidates.length - 1] ?? 'many';
  return boldParts(translate(`match.${many}`, vars));
}
