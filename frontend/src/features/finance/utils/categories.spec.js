import {
  addCategory,
  archiveCategory,
  CATEGORY_ICONS,
  CATEGORY_NAME_MAX,
  categoryNameProblem,
  editCategory,
  iconsFor,
  restoreCategory,
  typedCategoryName,
} from './categories';

const cat = (id, name, sortOrder, archivedAt = null) => ({
  id,
  name,
  icon: 'cart-outline',
  kind: 'expense',
  sortOrder,
  archivedAt,
});
const CATEGORIES = [
  cat('g', 'Groceries', 1),
  cat('t', 'תחבורה', 2),
  cat('old', 'Pets', 3, '2026-09-01T00:00:00Z'),
];

describe('typedCategoryName', () => {
  it('keeps English and Hebrew letters and single spaces', () => {
    expect(typedCategoryName('Coffee  וכריך')).toBe('Coffee וכריך');
    expect(typedCategoryName(' Café #2!')).toBe('Caf ');
    expect(typedCategoryName('a'.repeat(40))).toHaveLength(CATEGORY_NAME_MAX);
  });
});

describe('categoryNameProblem', () => {
  it('needs a name', () => {
    expect(categoryNameProblem('', CATEGORIES)).toBe(
      'finance.categoryNameRequired',
    );
    expect(categoryNameProblem('  ', CATEGORIES)).toBe(
      'finance.categoryNameRequired',
    );
  });

  it('refuses an active category’s name, in either language, any case', () => {
    expect(categoryNameProblem('groceries ', CATEGORIES)).toBe(
      'finance.categoryNameTaken',
    );
    expect(categoryNameProblem('תחבורה', CATEGORIES)).toBe(
      'finance.categoryNameTaken',
    );
  });

  it('takes a new name, or an archived one’s', () => {
    expect(categoryNameProblem('Coffee', CATEGORIES)).toBeNull();
    expect(categoryNameProblem('קפה', CATEGORIES)).toBeNull();
    expect(categoryNameProblem('Pets', CATEGORIES)).toBeNull();
  });
});

describe('addCategory', () => {
  it('adds an expense category at the end, trimmed, with a free local id', () => {
    const { categories, category } = addCategory(CATEGORIES, {
      name: 'Coffee ',
      icon: CATEGORY_ICONS[0],
    });
    expect(category).toEqual({
      id: 'cat-new-1',
      name: 'Coffee',
      icon: 'cafe-outline',
      kind: 'expense',
      sortOrder: 4,
      archivedAt: null,
    });
    expect(categories).toEqual([...CATEGORIES, category]);
    expect(
      addCategory(categories, { name: 'קפה', icon: 'x' }).category.id,
    ).toBe('cat-new-2');
  });

  it('works on an empty list', () => {
    expect(addCategory([], { name: 'A', icon: 'x' }).category.sortOrder).toBe(
      1,
    );
  });
});

describe('editCategory, archiveCategory and restoreCategory', () => {
  const two = [cat('a', 'Food', 1), cat('b', 'Gifts', 2)];

  it('change only that one', () => {
    const edited = editCategory(two, 'b', { name: ' Presents ', icon: 'x' });
    expect(edited).toEqual([
      two[0],
      { ...two[1], name: 'Presents', icon: 'x' },
    ]);
    const archived = archiveCategory(two, 'a', '2026-11-25');
    expect(archived.map((c) => c.archivedAt)).toEqual(['2026-11-25', null]);
    expect(restoreCategory(archived, 'a')).toEqual(two);
  });
});

describe('iconsFor', () => {
  it('has a category’s own icon first when it is not in the grid', () => {
    const grid = iconsFor(undefined);
    expect(iconsFor({ icon: grid[3] })).toEqual(grid);
    expect(iconsFor({ icon: 'receipt-outline' })).toEqual([
      'receipt-outline',
      ...grid,
    ]);
  });
});
