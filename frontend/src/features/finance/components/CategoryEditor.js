import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Alert from '../../../shared/components/base/feedback/Alert';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import {
  useIsRTL,
  usePlainInHebrew,
  useTranslate,
} from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import {
  addCategory,
  archiveCategory,
  categoryNameProblem,
  editCategory,
  restoreCategory,
} from '../utils/categories';
import { isolate } from '../utils/format';
import NewCategorySheet from './NewCategorySheet';

// Screens 23–24: the categories — pressing one edits or archives it, "+ New category" adds — and the archived
// ones, each with Restore (not while an active one has its name). The last active one can't be archived: an
// entry needs a category. `categories`, `onChange(categories)`.
export default function CategoryEditor({ categories, onChange }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const rtl = useIsRTL();
  // The sheet: null (closed), 'new', or the category edited.
  const [sheet, setSheet] = useState(null);
  // The archived category whose name is taken.
  const [taken, setTaken] = useState(null);
  const active = categories.filter((c) => !c.archivedAt);
  const archived = categories.filter((c) => c.archivedAt);
  const edited = sheet && sheet !== 'new' ? sheet : undefined;

  const apply = (next) => {
    onChange(next);
    setSheet(null);
    setTaken(null);
  };
  const restore = (category) => {
    if (categoryNameProblem(category.name, categories)) setTaken(category);
    else apply(restoreCategory(categories, category.id));
  };

  const divider = (i) =>
    i > 0 && [styles.divided, { borderTopColor: colors.cardBorderSoft }];

  return (
    <View style={styles.column}>
      <GlowCard>
        {active.map((c, i) => (
          <Pressable
            key={c.id}
            onPress={() => setSheet(c)}
            accessibilityRole="button"
            accessibilityHint={translate('categories.editHint')}
            testID={`category-${c.id}`}
            style={({ pressed }) => [
              styles.row,
              divider(i),
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={c.icon} size={18} color={colors.text} />
            <Text style={[styles.name, { color: colors.text }]}>{c.name}</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textMuted}
              style={rtl && styles.flip}
            />
          </Pressable>
        ))}
        <Pressable
          onPress={() => setSheet('new')}
          accessibilityRole="button"
          testID="category-new"
          style={({ pressed }) => [
            styles.row,
            divider(active.length),
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.name, { color: colors.accent }]}>
            {translate('finance.newCategory')}
          </Text>
        </Pressable>
      </GlowCard>
      {archived.length > 0 && (
        <>
          <Text style={[styles.heading, plain, { color: colors.textMuted }]}>
            {translate('categories.archived', { n: archived.length })}
          </Text>
          <GlowCard>
            {archived.map((c, i) => (
              <View key={c.id} style={[styles.row, divider(i)]}>
                <Ionicons name={c.icon} size={18} color={colors.textMuted} />
                <Text style={[styles.name, { color: colors.textMuted }]}>
                  {c.name}
                </Text>
                <Pressable
                  onPress={() => restore(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`${translate('categories.restore')} ${c.name}`}
                  testID={`category-restore-${c.id}`}
                  style={({ pressed }) => [
                    styles.restore,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.restoreText, { color: colors.accent }]}>
                    {translate('categories.restore')}
                  </Text>
                </Pressable>
              </View>
            ))}
          </GlowCard>
          {taken && (
            <View accessibilityLiveRegion="polite">
              <Alert>
                {translate('finance.categoryNameTaken', {
                  name: isolate(taken.name),
                })}
              </Alert>
            </View>
          )}
        </>
      )}
      <Text style={[styles.note, { color: colors.textMuted }]}>
        {translate('categories.archivedNote')}
      </Text>
      <NewCategorySheet
        visible={!!sheet}
        onClose={() => setSheet(null)}
        categories={categories}
        category={edited}
        onSave={(fields) =>
          apply(
            edited
              ? editCategory(categories, edited.id, fields)
              : addCategory(categories, fields).categories,
          )
        }
        onArchive={
          edited && active.length > 1
            ? () =>
                apply(
                  archiveCategory(
                    categories,
                    edited.id,
                    new Date().toISOString(),
                  ),
                )
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50 },
  divided: { borderTopWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, fontSize: 15 },
  flip: { transform: [{ scaleX: -1 }] },
  heading: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  restore: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  restoreText: { fontSize: 13 },
  pressed: { opacity: 0.6 },
  note: { fontSize: 12, lineHeight: 18 },
});
