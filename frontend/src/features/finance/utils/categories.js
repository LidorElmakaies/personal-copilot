// A new category (U4b.6, screen 14): its name's rules, the icons to pick from, and the category itself.
// Pure — Phase U keeps the list in the screen's memory; L2.5 and B2 save it through the API.
import { sanitizeName } from '../../../shared/utils/validation';

// Fits a chip; the Finance service (B2) checks the same.
export const CATEGORY_NAME_MAX = 30;

// The icon grid, in order (Ionicons names) — the first is picked to start.
export const CATEGORY_ICONS = [
  'cafe-outline',
  'cart-outline',
  'home-outline',
  'car-outline',
  'gift-outline',
  'heart-outline',
  'book-outline',
  'paw-outline',
  'airplane-outline',
  'flash-outline',
  'musical-notes-outline',
  'ellipsis-horizontal',
];

// The name field as typed: English and Hebrew letters and single spaces only (the app's name rule,
// project_english_hebrew_only), at most CATEGORY_NAME_MAX.
export const typedCategoryName = (text) =>
  sanitizeName(text).slice(0, CATEGORY_NAME_MAX);

const key = (name) => name.trim().toLocaleLowerCase();

// Why `name` can't be added yet — a dictionary key — or null: blank → 'finance.categoryNameRequired';
// the name of an active category (case and outer spaces ignored) → 'finance.categoryNameTaken'.
export function categoryNameProblem(name, categories) {
  if (!name.trim()) return 'finance.categoryNameRequired';
  const taken = categories.some(
    (c) => !c.archivedAt && key(c.name) === key(name),
  );
  return taken ? 'finance.categoryNameTaken' : null;
}

// `categories` with a new expense category at the end: `{ categories, category }`. Its id is
// local ("cat-new-1", …) until the API gives one (L2.5).
export function addCategory(categories, { name, icon }) {
  const used = new Set(categories.map((c) => c.id));
  let n = 1;
  while (used.has(`cat-new-${n}`)) n += 1;
  const category = {
    id: `cat-new-${n}`,
    name: name.trim(),
    icon,
    kind: 'expense',
    sortOrder: Math.max(0, ...categories.map((c) => c.sortOrder)) + 1,
    archivedAt: null,
  };
  return { categories: [...categories, category], category };
}
