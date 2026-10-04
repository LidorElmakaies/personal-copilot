import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../hooks/useAppTheme';

const OPTION_HEIGHT = 48;
const VISIBLE_OPTIONS = 4; // more than this and the list scrolls
const LIST_PADDING = 6;
const MIN_LIST_WIDTH = 220;
const GAP = 4; // between the box and the list
const EDGE = 8; // keep the list this far from the screen edges

/**
 * Shared dropdown — looks like InputField; the list of `options` ({ value, label, shortLabel? })
 * opens right under the box (above it if there's no room below) and scrolls past 4 options. The
 * closed box shows `shortLabel` when given (e.g. "🇮🇱 +972"), the list the full `label`.
 *
 * The list sits in a transparent Modal at the box's measured window position rather than inline:
 * inline it would be clipped by any ancestor with overflow:'hidden' (GlowCard) and drawn under
 * later siblings. The Modal's invisible backdrop only catches a tap outside to close it.
 */
export default function SelectField({
  label,
  value,
  options,
  onChange,
  style,
}) {
  const { colors } = useAppTheme();
  const window = useWindowDimensions();
  const boxRef = useRef(null);
  const [anchor, setAnchor] = useState(null); // box's window rect while open, else null
  const selected = options.find((o) => o.value === value);

  const open = () =>
    boxRef.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ x, y, width, height }),
    );
  const close = () => setAnchor(null);
  const choose = (next) => {
    close();
    onChange(next);
  };

  const listHeight =
    Math.min(options.length, VISIBLE_OPTIONS) * OPTION_HEIGHT +
    LIST_PADDING * 2;
  let listStyle = null;
  if (anchor) {
    const width = Math.min(
      Math.max(anchor.width, MIN_LIST_WIDTH),
      window.width - EDGE * 2,
    );
    const below = anchor.y + anchor.height + GAP;
    const fitsBelow = below + listHeight <= window.height - EDGE;
    listStyle = {
      left: Math.min(anchor.x, window.width - EDGE - width),
      top: fitsBelow ? below : Math.max(EDGE, anchor.y - GAP - listHeight),
      width,
      maxHeight: listHeight,
    };
  }

  return (
    <View style={[styles.wrapper, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      ) : null}
      <TouchableOpacity
        ref={boxRef}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.box,
          {
            backgroundColor: colors.inputBg,
            borderColor: anchor ? colors.inputFocusBorder : colors.inputBorder,
          },
        ]}
      >
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
          {selected ? (selected.shortLabel ?? selected.label) : '—'}
        </Text>
        <Ionicons
          name={anchor ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      <Modal visible={!!anchor} transparent onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        {listStyle ? (
          <View
            style={[
              styles.list,
              listStyle,
              // Solid page background — the translucent input colors let the form show through.
              {
                backgroundColor: colors.bg,
                borderColor: colors.cardBorder,
                shadowColor: colors.text,
              },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator
              persistentScrollbar
              bounces={false}
            >
              {options.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => choose(item.value)}
                  style={[
                    styles.option,
                    item.value === value && {
                      backgroundColor: colors.inputBg,
                    },
                  ]}
                >
                  <Text
                    style={[styles.optionText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {item.value === value ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  value: { fontSize: 15, flexShrink: 1 },
  list: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: LIST_PADDING,
    overflow: 'hidden',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  option: {
    height: OPTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
  },
  optionText: { fontSize: 15, flexShrink: 1 },
});
