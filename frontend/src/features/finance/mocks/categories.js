// Example categories (Phase U and L): the defaults a new user gets, in the API's shape (README §5).
// `icon` is an Ionicons name.
const category = (id, name, icon, sortOrder) => ({
  id,
  name,
  icon,
  kind: 'expense',
  sortOrder,
  archivedAt: null,
});

export const CATEGORIES = [
  category('cat-housing', 'Housing', 'home-outline', 1),
  category('cat-groceries', 'Groceries', 'cart-outline', 2),
  category('cat-eating-out', 'Eating out', 'restaurant-outline', 3),
  category('cat-transport', 'Transport', 'car-outline', 4),
  category('cat-bills', 'Bills', 'receipt-outline', 5),
  category('cat-subscriptions', 'Subscriptions', 'repeat-outline', 6),
  category('cat-shopping', 'Shopping', 'bag-handle-outline', 7),
  category('cat-gifts', 'Gifts', 'gift-outline', 8),
  category('cat-health', 'Health', 'medkit-outline', 9),
  category('cat-other', 'Other', 'ellipsis-horizontal', 10),
];
