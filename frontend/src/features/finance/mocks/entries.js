// October 2026's example entries, in the API's shape (README §5; money in whole agorot). Screen 1 of
// the canvas: today (TODAY) "Dinner with Dana" (Bit, not sent) and "Weekly groceries" (card, 2
// photos), "Fuel" on Oct 25; per category Housing ₪3,200, Groceries ₪1,860, Eating out ₪640 and 4
// more, ₪7,840 in all. `merchant` is set on the 36 entries the statement matched (statement.js
// builds those lines from it). No entry falls on a Saturday.
export const TODAY = '2026-10-27';

const agorot = (shekels) => Math.round(shekels * 100);

let next = 0;
const entry = (occurredOn, shekels, category, paidWith, description, own = {}) => {
  next += 1;
  const id = `entry-${String(next).padStart(2, '0')}`;
  return {
    id,
    clientId: `client-${id}`,
    occurredOn: `2026-10-${String(occurredOn).padStart(2, '0')}`,
    amountAgorot: agorot(shekels),
    direction: 'expense',
    categoryId: `cat-${category}`,
    paidWith,
    cardLast4: paidWith === 'card' ? '4821' : null,
    description,
    merchant: null,
    source: 'manual',
    attachmentIds: [],
    notSent: false,
    ...own,
  };
};
const card = (day, shekels, category, description, merchant, own) =>
  entry(day, shekels, category, 'card', description, { merchant, ...own });

export const ENTRIES = [
  // Housing ₪3,200
  card(1, 3200, 'housing', 'Rent', 'נכסי אלון בע"מ'),
  // Bills ₪600
  card(5, 312.4, 'bills', 'Electricity', 'חברת החשמל'),
  card(6, 98.6, 'bills', 'Water', 'מי אביבים'),
  card(11, 129, 'bills', 'Internet', 'בזק'),
  card(15, 60, 'bills', 'Phone', 'פרטנר'),
  // Subscriptions ₪400
  card(1, 249, 'subscriptions', 'Gym membership', 'הולמס פלייס'),
  card(4, 23.9, 'subscriptions', 'Spotify', 'SPOTIFY'),
  card(8, 11.9, 'subscriptions', 'iCloud storage', 'APPLE.COM/BILL'),
  card(14, 39.9, 'subscriptions', 'Disney+', 'DISNEY PLUS'),
  card(20, 23.9, 'subscriptions', 'YouTube Premium', 'GOOGLE *YOUTUBE'),
  card(20, 51.4, 'subscriptions', 'Haaretz', 'הארץ'),
  // Transport ₪620
  card(8, 290, 'transport', 'Fuel', 'פז תחנת דלק'),
  card(18, 20, 'transport', 'Parking', 'חניון אחוזת בית'),
  card(25, 310, 'transport', 'Fuel', 'פז תחנת דלק'),
  // Shopping ₪520
  card(7, 189.9, 'shopping', 'Sunglasses', 'אופטיקנה'),
  card(19, 234.1, 'shopping', 'Shelves for the study', 'IKEA'),
  card(26, 96, 'shopping', 'Two books', 'סטימצקי'),
  // Eating out ₪640
  card(7, 38, 'eating-out', 'Coffee and a sandwich', 'ארומה'),
  card(20, 120, 'eating-out', 'Sushi takeaway', "ג'ירף"),
  entry(12, 150, 'eating-out', 'bit', 'Dinner with Dana'),
  entry(14, 150, 'eating-out', 'bit', 'Pizza with the team'),
  entry(21, 32, 'eating-out', 'cash', 'Falafel'),
  entry(27, 150, 'eating-out', 'bit', 'Dinner with Dana', { notSent: true }),
  // Groceries ₪1,860
  entry(1, 460, 'groceries', 'transfer', 'Organic vegetable box'),
  card(2, 42.5, 'groceries', 'Challah and pastries', "מאפיית אנג'ל"),
  card(4, 38.9, 'groceries', 'Milk and eggs', 'AM:PM'),
  card(6, 268.4, 'groceries', 'Weekly groceries', 'שופרסל דיל'),
  card(7, 54.7, 'groceries', 'Toothpaste and shampoo', 'סופר-פארם'),
  card(9, 27.8, 'groceries', 'Snacks', 'AM:PM'),
  card(9, 24, 'groceries', 'Challah', "מאפיית אנג'ל"),
  card(11, 96.3, 'groceries', 'Cheese and wine', 'טיב טעם'),
  card(14, 31.6, 'groceries', 'Milk and bread', 'AM:PM'),
  card(15, 48.2, 'groceries', 'Fruit', 'פירות וירקות השוק'),
  card(16, 24, 'groceries', 'Challah', "מאפיית אנג'ל"),
  card(18, 59.9, 'groceries', 'Coffee beans', 'AM:PM'),
  card(19, 63.4, 'groceries', 'Cleaning supplies', 'שופרסל אקספרס'),
  card(21, 36.7, 'groceries', 'Milk and eggs', 'AM:PM'),
  card(22, 52.8, 'groceries', 'Fruit and vegetables', 'פירות וירקות השוק'),
  card(22, 78.6, 'groceries', 'Shabbat dinner shopping', 'טיב טעם'),
  card(23, 24, 'groceries', 'Challah', "מאפיית אנג'ל"),
  entry(23, 143.3, 'groceries', 'cash', 'Vegetables at the shuk'),
  card(27, 284.9, 'groceries', 'Weekly groceries', 'שופרסל דיל', {
    attachmentIds: ['attachment-01', 'attachment-02'],
  }),
];
