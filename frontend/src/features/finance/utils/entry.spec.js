import { entryProblem, RECEIVED_WITH } from './entry';

const problem = (own) =>
  entryProblem({ amount: '150', paidWith: 'bit', cardDigits: '', ...own });

describe('entryProblem', () => {
  it.each(['', '0', '0.', '0.00', '.'])('no amount: "%s"', (amount) => {
    expect(problem({ amount })).toBe('finance.amountRequired');
  });

  it('any amount will do', () => {
    expect(problem({ amount: '0.5' })).toBeNull();
    expect(problem({ amount: '150.' })).toBeNull();
  });

  it('a card needs its 4 digits', () => {
    const card = (cardDigits) => problem({ paidWith: 'card', cardDigits });
    expect(card('')).toBe('finance.cardDigitsRequired');
    expect(card('482')).toBe('finance.cardDigitsRequired');
    expect(card('4821')).toBeNull();
  });

  it('no other way to pay does', () => {
    expect(problem({ paidWith: 'cash', cardDigits: '48' })).toBeNull();
  });

  it('asks for the amount first', () => {
    expect(problem({ amount: '', paidWith: 'card' })).toBe(
      'finance.amountRequired',
    );
  });
});

describe('RECEIVED_WITH', () => {
  it('is every way but a card', () => {
    expect(RECEIVED_WITH).toEqual(['bit', 'paybox', 'cash', 'transfer']);
  });
});
