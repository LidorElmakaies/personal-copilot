import {
  editedEntry,
  entryDraft,
  entryFields,
  entryProblem,
  RECEIVED_WITH,
} from './entry';

const problem = (own) =>
  entryProblem({
    amount: '150',
    categoryId: 'a',
    paidWith: 'bit',
    cardDigits: '',
    ...own,
  });

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

  it('needs what it was for only when told, before the category', () => {
    expect(problem({ description: '' })).toBeNull();
    const charge = { descriptionRequired: true, categoryId: null };
    expect(problem({ ...charge, description: '  ' })).toBe(
      'finance.whatForRequired',
    );
    expect(problem({ ...charge, description: 'Gift' })).toBe(
      'finance.categoryRequired',
    );
  });

  it('needs a category', () => {
    expect(problem({ categoryId: null })).toBe('finance.categoryRequired');
  });

  it('asks for the amount, then the category, then the card', () => {
    const missing = { categoryId: null, paidWith: 'card' };
    expect(problem({ ...missing, amount: '' })).toBe('finance.amountRequired');
    expect(problem(missing)).toBe('finance.categoryRequired');
  });
});

describe('RECEIVED_WITH', () => {
  it('is every way but a card', () => {
    expect(RECEIVED_WITH).toEqual(['bit', 'paybox', 'cash', 'transfer']);
  });
});

describe('editedEntry', () => {
  const entry = {
    id: 'entry-01',
    amountAgorot: 28490,
    description: 'Weekly groceries',
    categoryId: 'a',
    direction: 'expense',
    paidWith: 'card',
    cardLast4: '4821',
    occurredOn: '2026-10-27',
    statementLine: { statementId: 's', lineNo: 42 },
  };
  const edited = (fields) =>
    editedEntry(entry, { ...entryFields(entryDraft(entry)), ...fields });

  it.each([
    ['the amount', { amountAgorot: 28500 }],
    ['the day', { occurredOn: '2026-10-26' }],
    ['the card', { cardLast4: '5520' }],
    ['how it was paid', { paidWith: 'cash', cardLast4: null }],
    ['spent or received', { direction: 'income' }],
  ])('changing %s removes the match', (_, fields) => {
    expect(edited(fields)).toEqual({
      ...entry,
      ...fields,
      statementLine: null,
    });
  });

  it('anything else keeps it', () => {
    expect(edited({})).toEqual(entry);
    const fields = { description: 'Food', categoryId: 'b' };
    expect(edited(fields)).toEqual({ ...entry, ...fields });
  });
});

describe('entryDraft and entryFields', () => {
  it('a new one is spent today, by card', () => {
    expect(entryDraft(undefined, '2026-10-27')).toEqual({
      amount: '',
      description: '',
      categoryId: null,
      direction: 'expense',
      paidWith: 'card',
      receivedWith: 'bit',
      date: '2026-10-27',
      cardDigits: '',
    });
  });

  it('every kind of entry comes back as it was', () => {
    const entry = {
      amountAgorot: 28490,
      description: 'Weekly groceries',
      categoryId: 'a',
      direction: 'expense',
      paidWith: 'card',
      cardLast4: '4821',
      occurredOn: '2026-10-25',
    };
    for (const own of [
      {},
      { paidWith: 'cash', cardLast4: null },
      { direction: 'income', paidWith: 'transfer', cardLast4: null },
    ]) {
      const one = { ...entry, ...own };
      expect(entryFields(entryDraft(one, '2026-10-27'))).toEqual(one);
    }
  });
});
