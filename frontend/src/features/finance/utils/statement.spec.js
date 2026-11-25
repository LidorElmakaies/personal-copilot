import { translateIn } from '../../../shared/i18n/translate';
import { STATEMENT_ERRORS, STATEMENT_LINES } from '../mocks';
import {
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
