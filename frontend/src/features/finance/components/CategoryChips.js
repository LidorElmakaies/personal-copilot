import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { chipsThatFit } from '../utils/chips';
import FilterChip from './FilterChip';

const GAP = 6;
const MORE = 'more';

// The add sheet's category pills (screen 2): any number selected — a tap adds one, another drops it.
// Past two lines the rest wait behind "More…" (selected ones always show) until "Less". Which
// ones fit is measured: every chip is laid out once, unseen, first. `categories` `[{ id, name }]`, `selectedIds`, `onChange(ids)`; `defaultOpen`.
export default function CategoryChips({
  categories,
  selectedIds,
  onChange,
  defaultOpen = false,
}) {
  const translate = useTranslate();
  const [open, setOpen] = useState(defaultOpen);
  const [room, setRoom] = useState(0);
  const [widths, setWidths] = useState({});

  const measure = (id) => (e) => {
    const { width } = e.nativeEvent.layout;
    setWidths((w) => (w[id] === width ? w : { ...w, [id]: width }));
  };

  const ids = categories.map((c) => c.id);
  const measured = room > 0 && [...ids, MORE].every((id) => widths[id] > 0);
  const fitting = measured
    ? chipsThatFit(ids, (id) => widths[id], {
        moreWidth: widths[MORE],
        room,
        keepIds: selectedIds,
        gap: GAP,
      })
    : ids;
  const overflows = measured && fitting.length < ids.length;
  const shown = open
    ? categories
    : categories.filter((c) => fitting.includes(c.id));
  const less = open && measured;
  const toggle = (id) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id],
    );

  return (
    <View
      onLayout={(e) => setRoom(e.nativeEvent.layout.width)}
      style={[styles.chips, !measured && styles.unseen]}
      testID="category-chips"
    >
      {shown.map((c) => (
        <View
          key={c.id}
          onLayout={measure(c.id)}
          testID={`category-chip-${c.id}`}
        >
          <FilterChip
            label={c.name}
            on={selectedIds.includes(c.id)}
            onPress={() => toggle(c.id)}
          />
        </View>
      ))}
      {(overflows || !measured) && (
        // "Less" is another view, so it's never measured as "More…".
        <View
          key={less ? 'less' : MORE}
          onLayout={less ? undefined : measure(MORE)}
          testID="category-chips-more"
        >
          <FilterChip
            label={translate(less ? 'finance.less' : 'finance.more')}
            accessibilityLabel={translate(
              less ? 'finance.fewerCategories' : 'finance.allCategories',
            )}
            onPress={() => setOpen(!open)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  unseen: { opacity: 0 },
});
