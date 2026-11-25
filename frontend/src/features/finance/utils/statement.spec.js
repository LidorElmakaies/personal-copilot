import { translateIn } from '../../../shared/i18n/translate';
import { STATEMENT_ERRORS, STATEMENT_LINES } from '../mocks';
import {
  confirmLine,
  matchText,
  rejectLine,
  statementErrorText,
  statementProblem,
  statementSteps,
  statementSummary,
} from './statement';

describe('statementSteps', () => {
  it.each([
    ['received', ['done', 'active', 'waiting']],
    ['parsing', ['done', 'active', 'waiting']],
    ['matching', ['done', 'done', 'active']],
    ['needs_review', ['done', 'done', 'done']],
    ['closed', ['done', 'done', 'done']],
  ])('%s → %j', (status, states) => {
    expect(statementSteps(status).map((s) => s.state)).toEqual(states);
  });
});

describe('statementErrorText', () => {
  const say = (error, source = 'text') =>
    statementErrorText((k, v) => translateIn('en', k, v), error, source);
  const text = (said) => said.parts.map((p) => p.text).join('');

  it('marks both amounts bold', () => {
    const { parts } = say(STATEMENT_ERRORS.totalsMismatch);
    expect(parts.filter((p) => p.bold).map((p) => p.text)).toEqual([
      '₪7,612',
      '₪7,840',
    ]);
  });

  it('tells a file from pasted text', () => {
    expect(text(say(STATEMENT_ERRORS.totalsMismatch, 'text'))).toMatch(
      /paste again/,
    );
    expect(text(say(STATEMENT_ERRORS.totalsMismatch, 'file'))).toMatch(
      /download the month again/,
    );
  });

  it('only an unreachable LLM is worth retrying', () => {
    const retries = Object.values(STATEMENT_ERRORS).filter((e) => say(e).retry);
    expect(retries).toEqual([STATEMENT_ERRORS.llmUnreachable]);
  });

  it('says how often the LLM was tried', () => {
    expect(text(say(STATEMENT_ERRORS.llmUnreachable))).toMatch(
      /^Tried 3 times\. Is FreeToken/,
    );
  });

  it.each([[STATEMENT_ERRORS.unknown], [{ code: 'new_one' }], [null]])(
    '%j is unknown',
    (error) => {
      expect(say(error).title).toBe('Something went wrong');
    },
  );
});

describe('matchText', () => {
  const entries = ['Dinner', 'Pizza', 'מתנה'].map((description, i) => ({
    description,
    occurredOn: `2026-10-${12 + i}`,
  }));
  const say = (n, shown, language = 'en') =>
    matchText(
      (k, v) => translateIn(language, k, v),
      entries.slice(0, n),
      shown,
    );
  const text = (parts) =>
    parts
      .map((p) => p.text)
      .join('')
      .replace(/[\u2066-\u2069\u200e\u200f]/g, '');

  it('says how many match and the likeliest', () => {
    expect(text(say(1, 0))).toBe(
      'One of your entries matches: Dinner (Oct 12).',
    );
    expect(text(say(2, 0))).toBe(
      'Two of your entries match. Most likely: Dinner (Oct 12).',
    );
    expect(text(say(3, 0))).toBe(
      '3 of your entries match. Most likely: Dinner (Oct 12).',
    );
  });

  it('then the others', () => {
    expect(text(say(2, 1))).toBe('Or: Pizza (Oct 13).');
    expect(text(say(3, 2, 'he'))).toContain('מתנה');
  });

  it('only the entry is bold', () => {
    expect(say(2, 0).filter((p) => p.bold)).toEqual([
      { text: '\u2068Dinner\u2069', bold: true },
    ]);
  });
});

describe('confirmLine and rejectLine', () => {
  const line = (id, ...candidateEntryIds) => ({
    id,
    matchStatus: 'suggested',
    entryId: null,
    suggestion: { candidateEntryIds },
  });
  const lines = [line('1', 'a', 'b'), line('2', 'a', 'b', 'c'), line('3', 'a')];

  it('confirming takes the entry from the other questions', () => {
    const [one, two, three] = confirmLine(lines, '1', 'a');
    expect(one).toMatchObject({
      matchStatus: 'confirmed',
      entryId: 'a',
      suggestion: null,
    });
    expect(two.suggestion.candidateEntryIds).toEqual(['b', 'c']);
    expect(three).toMatchObject({ matchStatus: 'unmatched', suggestion: null });
  });

  it('rejecting makes only that line not reported', () => {
    const [one, two] = rejectLine(lines, '1');
    expect(one).toMatchObject({ matchStatus: 'unmatched', suggestion: null });
    expect(two).toBe(lines[1]);
  });
});

describe('statementSummary', () => {
  it('gives October as on the canvas: 6 to answer, 36 already reported', () => {
    expect(statementSummary(STATEMENT_LINES)).toEqual({
      toAnswer: 6,
      reported: 36,
      month: { year: 2026, month: 10 },
    });
  });

  it('counts answered and ignored lines as neither', () => {
    const line = (matchStatus, occurredOn = '2026-09-30') => ({
      matchStatus,
      occurredOn,
    });
    expect(
      statementSummary([
        line('answered'),
        line('ignored'),
        line('confirmed'),
        line('suggested', '2026-10-02'),
      ]),
    ).toEqual({ toAnswer: 1, reported: 1, month: { year: 2026, month: 10 } });
  });

  it('is empty for no lines', () => {
    expect(statementSummary([])).toEqual({
      toAnswer: 0,
      reported: 0,
      month: null,
    });
  });
});

describe('statementProblem', () => {
  const problem = (own) =>
    statementProblem({
      card: '4821',
      source: 'text',
      file: null,
      text: '14/10/26 BIT 150.00',
      total: '150',
      ...own,
    });

  it.each([
    [{}, null],
    [{ total: '0' }, null],
    [{ card: null }, 'statement.cardRequired'],
    [{ text: '  ' }, 'statement.textRequired'],
    [{ total: '' }, 'statement.totalRequired'],
    [{ source: 'file' }, 'statement.fileRequired'],
    [{ source: 'file', file: { name: 'a.xlsx' }, text: '', total: '' }, null],
  ])('%j → %s', (own, key) => {
    expect(problem(own)).toBe(key);
  });
});
