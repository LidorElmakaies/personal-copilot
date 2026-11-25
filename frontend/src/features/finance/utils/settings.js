// Screen 10's settings (kept on the phone, L7.1). Cards: `[{ cardLast4, issuer, billingDay }]`, the issuer
// optional.
export const DEFAULT_BILLING_DAY = 10;

// A card added by its digits; one already there changes nothing.
export const addCard = (cards, cardLast4) =>
  cards.some((c) => c.cardLast4 === cardLast4)
    ? cards
    : [...cards, { cardLast4, billingDay: DEFAULT_BILLING_DAY }];

export const removeCard = (cards, cardLast4) =>
  cards.filter((c) => c.cardLast4 !== cardLast4);

export const setBillingDay = (cards, cardLast4, billingDay) =>
  cards.map((c) => (c.cardLast4 === cardLast4 ? { ...c, billingDay } : c));
