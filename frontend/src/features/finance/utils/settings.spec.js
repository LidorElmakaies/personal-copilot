import { addCard, removeCard, setBillingDay } from './settings';

const cards = [{ cardLast4: '4821', issuer: 'MAX', billingDay: 2 }];

describe('addCard, removeCard and setBillingDay', () => {
  it('adds a card once, billed on the 10th', () => {
    const two = addCard(cards, '5520');
    expect(two).toEqual([...cards, { cardLast4: '5520', billingDay: 10 }]);
    expect(addCard(two, '4821')).toBe(two);
  });

  it('removes only that card', () => {
    expect(removeCard(addCard(cards, '5520'), '5520')).toEqual(cards);
    expect(removeCard(cards, '4821')).toEqual([]);
  });

  it('changes only that card’s day', () => {
    const two = addCard(cards, '5520');
    expect(setBillingDay(two, '5520', 15).map((c) => c.billingDay)).toEqual([
      2, 15,
    ]);
  });
});
