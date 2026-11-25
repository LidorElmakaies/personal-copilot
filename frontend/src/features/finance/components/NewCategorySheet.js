import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import InputField from '../../../shared/components/base/form/InputField';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import { usePlainInHebrew, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import {
  CATEGORY_ICONS,
  categoryNameProblem,
  iconsFor,
  typedCategoryName,
} from '../utils/categories';

// Screen 14: a new category — its name (English or Hebrew letters, not an active category's) and an
// icon from a grid; "Add category" gives `onSave({ name, icon })`. Opened from the chips' "+ New" and
// the filter sheet's and `CategoryEditor`'s "+ New category". With `category` it edits that one (screen 24):
// filled in, Save, and Archive while `onArchive` is set. `visible`, `onClose`, `categories` (the ones its name mustn't repeat).
export default function NewCategorySheet({
  visible,
  onClose,
  categories,
  category,
  onSave,
  onArchive,
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {visible && (
        <CategoryForm
          categories={categories}
          category={category}
          onSave={onSave}
          onArchive={onArchive}
        />
      )}
    </BottomSheet>
  );
}

function CategoryForm({ categories, category, onSave, onArchive }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? CATEGORY_ICONS[0]);
  const problem = categoryNameProblem(
    name,
    categories.filter((c) => c.id !== category?.id),
  );
  // A blank name only keeps the button off; a taken one says so.
  const error =
    problem === 'finance.categoryNameTaken'
      ? translate(problem, { name: `⁨${name.trim()}⁩` })
      : undefined;

  return (
    <>
      <Text style={[styles.title, { color: colors.text }]}>
        {translate(category ? 'categories.edit' : 'finance.newCategoryTitle')}
      </Text>
      {/* Shrinks under the keyboard (BottomSheet), so Add stays in reach. */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        <InputField
          label={translate('finance.categoryName')}
          value={name}
          onChangeText={(text) => setName(typedCategoryName(text))}
          autoCapitalize="words"
          hint={error ? undefined : translate('finance.categoryNameHint')}
          error={error}
          testID="new-category-name"
        />
        <View style={styles.section}>
          <Text style={[styles.label, plain, { color: colors.textMuted }]}>
            {translate('finance.categoryIcon')}
          </Text>
          <View style={styles.grid}>
            {iconsFor(category).map((ic) => {
              const on = ic === icon;
              return (
                <Pressable
                  key={ic}
                  onPress={() => setIcon(ic)}
                  accessibilityRole="button"
                  accessibilityLabel={translate(`categoryIcon.${ic}`)}
                  accessibilityState={{ selected: on }}
                  testID={`new-category-icon-${ic}`}
                  style={({ pressed }) => [
                    styles.icon,
                    {
                      borderColor: on ? colors.accent : colors.cardBorder,
                      backgroundColor: on
                        ? `${colors.accent}1F`
                        : 'transparent',
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={ic}
                    size={20}
                    color={on ? colors.accent : colors.text}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
        {!category && (
          <View style={[styles.note, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="cloud-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.noteText, { color: colors.textMuted }]}>
              {translate('finance.categorySavedNote')}
            </Text>
          </View>
        )}
      </ScrollView>
      <GradientButton
        label={translate(category ? 'common.save' : 'finance.addCategory')}
        onPress={() => onSave({ name: name.trim(), icon })}
        disabled={!!problem}
        testID="new-category-add"
      />
      {onArchive && (
        <View style={styles.archive}>
          <Pressable
            onPress={onArchive}
            accessibilityRole="button"
            testID="category-archive"
            style={({ pressed }) => [
              styles.archiveButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.archiveText, { color: colors.pending }]}>
              {translate('categories.archive')}
            </Text>
          </Pressable>
          <Text style={[styles.archiveNote, { color: colors.textMuted }]}>
            {translate('categories.archiveNote')}
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '600' },
  body: { flexShrink: 1 },
  bodyContent: { gap: 14 },
  section: { gap: 8 },
  label: { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Six to a row, as drawn.
  icon: {
    width: '14.5%',
    maxWidth: '14.8%', // a 13th icon (iconsFor) doesn't fill its row
    flexGrow: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  noteText: { flex: 1, fontSize: 12 },
  archive: { alignItems: 'center' },
  archiveButton: { minHeight: 44, justifyContent: 'center' },
  archiveText: { fontSize: 14 },
  archiveNote: { fontSize: 12, textAlign: 'center' },
});
