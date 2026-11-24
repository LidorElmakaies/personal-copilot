import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import Alert from '../../../shared/components/base/feedback/Alert';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import InputField from '../../../shared/components/base/form/InputField';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import { useIsRTL, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { parseShekels, typedShekels } from '../utils/format';
import { statementProblem } from '../utils/statement';
import SegmentRow from './SegmentRow';

// The statement to check (screen 4): "Upload file" — a card saying where to get it, and Choose file… —
// or "Paste text" — the text and the statement's total. Check statement stays under the scrolling body,
// above the keyboard; it says what's missing (`statementProblem`), else calls
// `onCheck({ source: 'file', file })` or `({ source: 'text', text, totalAgorot })`. Switching keeps both
// sides. `header` scrolls with the body (the title, `CardChips`); `card` (last 4 digits, or null) and its `issuer`
// (optional), `file` `{ name }` (null: none chosen), `onChooseFile`; `defaultSource`, `defaultText`. Has its own 20 dp gutter.
export default function StatementSource({
  header,
  card,
  issuer,
  file,
  onChooseFile,
  onCheck,
  defaultSource = 'file',
  defaultText = '',
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const rtl = useIsRTL();
  const [source, setSource] = useState(defaultSource);
  const [text, setText] = useState(defaultText);
  const [total, setTotal] = useState('');
  // The message shows once Check was pressed, and follows the fields until nothing's missing.
  const [tried, setTried] = useState(false);
  const problem = statementProblem({ card, source, file, text, total });

  const check = () => {
    if (problem) {
      setTried(true);
      return;
    }
    Keyboard.dismiss();
    onCheck(
      source === 'file'
        ? { source, file }
        : { source, text: text.trim(), totalAgorot: parseShekels(total) },
    );
  };

  // How much of this the keyboard covers (Android may or may not have made room for it already).
  const root = useRef(null);
  const [covered, setCovered] = useState(0);
  const measure = (keyboardY) =>
    root.current?.measureInWindow((x, y, width, height) =>
      setCovered(Math.max(0, y + height - keyboardY)),
    );
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      measure(e.endCoordinates.screenY),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setCovered(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  // Already up as this opens (from a search field): no event will come.
  const measureOpen = () => {
    const keyboard = Keyboard.metrics();
    if (keyboard) measure(keyboard.screenY);
  };

  // The field typed in, brought back into view once the body has shrunk.
  const scroll = useRef(null);
  const tops = useRef({});
  const typing = useRef(null);
  const field = (name) => ({
    onFocus: () => {
      typing.current = name;
    },
    onBlur: () => {
      typing.current = null;
    },
  });
  const top = (name) => (e) => {
    tops.current[name] = e.nativeEvent.layout.y;
  };

  return (
    <View
      ref={root}
      collapsable={false}
      onLayout={measureOpen}
      style={[styles.root, { paddingBottom: covered && covered + 12 }]}
    >
      <ScrollView
        ref={scroll}
        style={styles.body}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onLayout={() => {
          if (!typing.current) return;
          // A frame later, after Android's own scroll to the focused field.
          requestAnimationFrame(() =>
            scroll.current?.scrollTo({ y: tops.current[typing.current] }),
          );
        }}
      >
        {header}
        <SegmentRow
          options={['file', 'text'].map((s) => ({
            value: s,
            label: translate(`statement.${s}`),
          }))}
          value={source}
          onChange={setSource}
          testID="statement-source"
        />
        {source === 'file' ? (
          <GlowCard>
            <View style={styles.card}>
              <Ionicons
                name={file ? 'document-text-outline' : 'grid-outline'}
                size={34}
                color={colors.accent}
                style={styles.icon}
              />
              <Text style={[styles.cardText, { color: colors.text }]}>
                {file
                  ? file.name
                  : issuer
                    ? translate('statement.download', { issuer })
                    : translate('statement.downloadAny')}
              </Text>
              <GradientButton
                label={translate(
                  file ? 'statement.chooseAnother' : 'statement.choose',
                )}
                onPress={onChooseFile}
                testID="statement-choose"
              />
            </View>
          </GlowCard>
        ) : (
          <>
            <View onLayout={top('text')}>
              <InputField
                label={translate('statement.pasteLabel')}
                value={text}
                onChangeText={setText}
                multiline
                monospace
                autoCorrect={false}
                inputStyle={styles.paste}
                testID="statement-text"
                {...field('text')}
              />
            </View>
            <View onLayout={top('total')}>
              <InputField
                label={translate('statement.total')}
                value={total}
                onChangeText={(typed) => setTotal(typedShekels(typed))}
                placeholder="0.00"
                keyboardType="decimal-pad"
                inputStyle={[styles.total, rtl && styles.totalRTL]}
                testID="statement-total"
                {...field('total')}
              />
            </View>
          </>
        )}
      </ScrollView>
      {tried && problem && (
        <View accessibilityLiveRegion="polite" style={styles.bottom}>
          <Alert>{translate(problem)}</Alert>
        </View>
      )}
      <GradientButton
        label={translate('statement.check')}
        onPress={check}
        style={styles.bottom}
        testID="statement-check"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12 },
  body: { flex: 1 },
  // The screen's gutter, inside the scroll so the card's glow isn't cut.
  content: { gap: 16, paddingHorizontal: 20, paddingBottom: 24 },
  bottom: { marginHorizontal: 20 },
  card: { gap: 14 },
  icon: { alignSelf: 'center' },
  cardText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  // Long text scrolls inside.
  paste: { minHeight: 120, maxHeight: 200, fontSize: 12, lineHeight: 18 },
  // "ltr": the cursor stays after the digits in Hebrew too.
  total: { direction: 'ltr' },
  totalRTL: { textAlign: 'right' },
});
