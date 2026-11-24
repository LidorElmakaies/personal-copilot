import { STATEMENT_LINES } from '../mocks';
import { statementProblem, statementSummary } from './statement';

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
