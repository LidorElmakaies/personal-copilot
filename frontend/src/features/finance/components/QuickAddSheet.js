import { useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Alert from '../../../shared/components/base/feedback/Alert';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import InputField from '../../../shared/components/base/form/InputField';
import { usePlainInHebrew, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import {
  entryDraft,
  entryFields,
  entryProblem,
  RECEIVED_WITH,
} from '../utils/entry';
import { typedDescription } from '../utils/format';
import { chargeEntry } from '../utils/statement';
import AmountInput from './AmountInput';
import CardDigitsField from './CardDigitsField';
import CategoryChips from './CategoryChips';
import ChargeSummary from './ChargeSummary';
import DateField from './DateField';
import DayPicker from './DayPicker';
import DirectionPicker from './DirectionPicker';
import PaidWithPicker from './PaidWithPicker';
import PhotosField from './PhotosField';

// Screen 2, the add sheet the + opens: the title and the day (today to start), spent or received, the
// amount, what it was for, its category, how it was paid (Card to start, with the card's digits), its photos and Save. Save says what's missing (`entryProblem`),
// or calls `onSave(fields, photos)` — an entry's own fields — and closes. Money received has no card. Starts
// empty each time it opens, or from `entry` and its `entryPhotos` to edit it ("Edit entry", the keyboard closed).
// `charge` `{ line, cardLast4, n, total }` answers a statement's charge instead (screen 7): "1 of 5" and Skip for now
// (`onSkip`) on top, the charge in place of the amount, the day and how it was paid, and Save · next, which
// doesn't close: the next `charge` starts empty.
// `categories` (in the chips' order), one picked, required; `cards` (those used, the last one first), `today`
// (YYYY-MM-DD), `pickPhotos` (PhotosField's); `visible`, `onClose`. Nothing closes the keyboard but a tap on an empty spot (the title,
// the body, the backdrop) or Back.
export default function QuickAddSheet({
  visible,
  onClose,
  categories,
  cards,
  today,
  pickPhotos,
  entry,
  entryPhotos,
  charge,
  onSkip,
  onSave,
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} dragFromHandle>
      {visible && (
        <QuickAddForm
          key={charge?.line.id}
          charge={charge}
          onSkip={onSkip}
          categories={categories}
          cards={cards}
          today={today}
          pickPhotos={pickPhotos}
          entry={entry}
          entryPhotos={entryPhotos}
          onSave={(fields, photos) => {
            onSave?.(fields, photos);
            if (!charge) onClose();
          }}
        />
      )}
    </BottomSheet>
  );
}

function QuickAddForm({
  categories,
  cards,
  today,
  pickPhotos,
  entry,
  entryPhotos = [],
  charge,
  onSkip,
  onSave,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const { height } = useWindowDimensions();
  const [start] = useState(() =>
    entryDraft(
      charge ? chargeEntry(charge.line, charge.cardLast4) : entry,
      today,
    ),
  );
  const [amount, setAmount] = useState(start.amount);
  const [description, setDescription] = useState(start.description);
  const [categoryId, setCategoryId] = useState(start.categoryId);
  const [direction, setDirection] = useState(start.direction);
  const [paidWith, setPaidWith] = useState(start.paidWith);
  const [receivedWith, setReceivedWith] = useState(start.receivedWith);
  const [date, setDate] = useState(start.date);
  const [pickingDay, setPickingDay] = useState(false);
  const [cardDigits, setCardDigits] = useState(start.cardDigits);
  const [photos, setPhotos] = useState(entryPhotos);
  // The message shows once Save was pressed, and follows the fields until nothing's missing.
  const [tried, setTried] = useState(false);
  const received = direction === 'income';
  const problem = entryProblem({
    amount,
    description,
    descriptionRequired: !!charge,
    categoryId,
    paidWith: received ? receivedWith : paidWith,
    cardDigits,
  });
  const save = () => {
    if (problem) {
      setTried(true);
      return;
    }
    const draft = {
      amount,
      description,
      categoryId,
      direction,
      paidWith,
      receivedWith,
      date,
      cardDigits,
    };
    onSave(entryFields(draft), photos);
  };
  // The keyboard shrinks the body (BottomSheet): the card field, low in it, is scrolled back into view.
  const scroll = useRef(null);
  const typingCard = useRef(false);
  const cardTop = useRef(0);
  // "Camera / Gallery" opens at the body's end, perhaps below what shows.
  const askingPhotos = useRef(false);
  const toggleDays = () => {
    setPickingDay(!pickingDay);
    scroll.current?.scrollTo({ y: 0 });
  };
  return (
    <>
      <Pressable
        onPress={Keyboard.dismiss}
        accessible={false}
        style={styles.header}
      >
        {charge ? (
          <>
            <Text style={[styles.label, plain, { color: colors.textMuted }]}>
              {translate('charge.position', {
                n: charge.n,
                total: charge.total,
              })}
            </Text>
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              testID="charge-skip"
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            >
              <Text style={[styles.skipText, { color: colors.textMuted }]}>
                {translate('charge.skip')}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>
              {translate(entry ? 'finance.editEntry' : 'finance.newEntry')}
            </Text>
            <DateField value={date} today={today} onPress={toggleDays} />
          </>
        )}
      </Pressable>
      {/* Scrolls: under the keyboard (BottomSheet shrinks it) and past 60% of the screen. */}
      <ScrollView
        ref={scroll}
        onLayout={() => {
          if (typingCard.current) {
            // A frame later, after Android's own scroll to the focused field.
            requestAnimationFrame(() =>
              scroll.current?.scrollTo({ y: cardTop.current }),
            );
          }
        }}
        onContentSizeChange={() => {
          if (askingPhotos.current) scroll.current?.scrollToEnd();
          askingPhotos.current = false;
        }}
        style={[styles.body, { maxHeight: height * 0.6 }]}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {pickingDay && (
          <DayPicker
            value={date}
            today={today}
            onChange={(day) => {
              setDate(day);
              setPickingDay(false);
            }}
          />
        )}
        {charge ? (
          <ChargeSummary line={charge.line} />
        ) : (
          <>
            <DirectionPicker value={direction} onChange={setDirection} />
            <AmountInput
              value={amount}
              onChangeText={setAmount}
              autoFocus={!entry}
              received={received}
            />
          </>
        )}
        <InputField
          label={translate('finance.whatFor')}
          value={description}
          onChangeText={(text) => setDescription(typedDescription(text))}
          placeholder={translate(
            received ? 'finance.receivedHint' : 'finance.whatForHint',
          )}
          autoCapitalize="sentences"
          testID="quick-add-description"
        />
        <View style={styles.section}>
          <Text style={[styles.label, plain, { color: colors.textMuted }]}>
            {translate('finance.category')}
          </Text>
          <CategoryChips
            categories={categories}
            selectedId={categoryId}
            onChange={setCategoryId}
          />
        </View>
        {!charge && (
          <View style={styles.section}>
            <Text style={[styles.label, plain, { color: colors.textMuted }]}>
              {translate(
                received
                  ? 'finance.receivedWithTitle'
                  : 'finance.paidWithTitle',
              )}
            </Text>
            {received ? (
              <PaidWithPicker
                value={receivedWith}
                onChange={setReceivedWith}
                options={RECEIVED_WITH}
              />
            ) : (
              <PaidWithPicker value={paidWith} onChange={setPaidWith} />
            )}
          </View>
        )}
        {!charge && !received && paidWith === 'card' && (
          <View
            onLayout={(e) => {
              cardTop.current = e.nativeEvent.layout.y;
            }}
          >
            <CardDigitsField
              value={cardDigits}
              onChange={setCardDigits}
              cards={cards}
              onFocus={() => {
                typingCard.current = true;
              }}
              onBlur={() => {
                typingCard.current = false;
              }}
            />
          </View>
        )}
        <PhotosField
          photos={photos}
          onChange={setPhotos}
          pickPhotos={pickPhotos}
          onAsk={() => {
            askingPhotos.current = true;
          }}
        />
      </ScrollView>
      {tried && problem && (
        <View accessibilityLiveRegion="polite">
          <Alert>{translate(problem)}</Alert>
        </View>
      )}
      <GradientButton
        label={translate(
          charge && charge.n < charge.total ? 'charge.saveNext' : 'common.save',
        )}
        onPress={save}
        testID="quick-add-save"
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  title: { fontSize: 18, fontWeight: '600' },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  skipText: { fontSize: 13 },
  pressed: { opacity: 0.6 },
  body: { flexShrink: 1 },
  bodyContent: { gap: 14 },
  section: { gap: 6 },
  // As InputField's label.
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
