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
import { entryProblem, RECEIVED_WITH } from '../utils/entry';
import { typedDescription } from '../utils/format';
import AmountInput from './AmountInput';
import CardDigitsField from './CardDigitsField';
import CategoryChips from './CategoryChips';
import DateField from './DateField';
import DayPicker from './DayPicker';
import DirectionPicker from './DirectionPicker';
import PaidWithPicker from './PaidWithPicker';
import PhotosField from './PhotosField';

// Screen 2, the add sheet the + opens: the title and the day (today to start), spent or received, the
// amount, what it was for, its categories, how it was paid (Card to start, with the card's digits), its photos and Save. Save closes it (L2 adds the entry), or says what's missing
// (`entryProblem`). Money received has no card. Starts empty each time it opens.
// `categories` (in the chips' order), any number picked; `cards` (those used, the last one first), `today`
// (YYYY-MM-DD), `pickPhotos` (PhotosField's); `visible`, `onClose`. Nothing closes the keyboard but a tap on an empty spot (the title,
// the body, the backdrop) or Back.
export default function QuickAddSheet({
  visible,
  onClose,
  categories,
  cards,
  today,
  pickPhotos,
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} dragFromHandle>
      {visible && (
        <QuickAddForm
          categories={categories}
          cards={cards}
          today={today}
          pickPhotos={pickPhotos}
          onSave={onClose}
        />
      )}
    </BottomSheet>
  );
}

function QuickAddForm({ categories, cards, today, pickPhotos, onSave }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const { height } = useWindowDimensions();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryIds, setCategoryIds] = useState([]);
  const [direction, setDirection] = useState('expense');
  const [paidWith, setPaidWith] = useState('card');
  const [receivedWith, setReceivedWith] = useState(RECEIVED_WITH[0]);
  const [date, setDate] = useState(today);
  const [pickingDay, setPickingDay] = useState(false);
  const [cardDigits, setCardDigits] = useState('');
  const [photos, setPhotos] = useState([]);
  // The message shows once Save was pressed, and follows the fields until nothing's missing.
  const [tried, setTried] = useState(false);
  const received = direction === 'income';
  const problem = entryProblem({
    amount,
    paidWith: received ? receivedWith : paidWith,
    cardDigits,
  });
  const save = () => (problem ? setTried(true) : onSave());
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
        <Text style={[styles.title, { color: colors.text }]}>
          {translate('finance.newEntry')}
        </Text>
        <DateField value={date} today={today} onPress={toggleDays} />
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
        <DirectionPicker value={direction} onChange={setDirection} />
        <AmountInput
          value={amount}
          onChangeText={setAmount}
          received={received}
        />
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
            {translate('finance.categoriesTitle')}
          </Text>
          <CategoryChips
            categories={categories}
            selectedIds={categoryIds}
            onChange={setCategoryIds}
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, plain, { color: colors.textMuted }]}>
            {translate(
              received ? 'finance.receivedWithTitle' : 'finance.paidWithTitle',
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
        {!received && paidWith === 'card' && (
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
        label={translate('common.save')}
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
