import { parseShekels } from './format';

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

// Why a statement can't be checked yet — a dictionary key — or null: no card, no file, or no text or
// total (as typed; ₪0 is one: a month of refunds can come to it).
export function statementProblem({ card, source, file, text, total }) {
  if (!card) return 'statement.cardRequired';
  if (source === 'file') return file ? null : 'statement.fileRequired';
  if (!text.trim()) return 'statement.textRequired';
  return parseShekels(total) === null ? 'statement.totalRequired' : null;
}
