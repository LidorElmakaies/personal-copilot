import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import PillButton from '../../../shared/components/base/buttons/PillButton';
import Stepper from '../../../shared/components/base/form/Stepper';
import Switch from '../../../shared/components/base/form/Switch';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import ConfirmModal from '../../../shared/components/composite/ConfirmModal';
import { ordinal } from '../../../shared/i18n/format';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { cardName } from '../utils/format';
import { addCard, removeCard, setBillingDay } from '../utils/settings';
import CardDigitsField from './CardDigitsField';

// Screen 10's settings: each card's billing day and "+ Another card", the reminders — one switch
// and one time for all of them, billing days and evenings — and Categories. A card's pill opens its day and Remove card (asks
// first) under its row, one at a time. `settings` `{ cards: [{ cardLast4,
// issuer, billingDay }], reminders: { enabled, hour, minute } }`, `onChange(settings)`, `usedCards` (digits,
// offered under "+ Another card"), `onCategories`.
export default function FinanceSettings({
  settings,
  onChange,
  usedCards = [],
  onCategories,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  // A card's digits, 'add', or null.
  const [open, setOpen] = useState(null);
  const [digits, setDigits] = useState('');
  const [removing, setRemoving] = useState(null);
  const { cards, reminders } = settings;
  const toggle = (what) => setOpen(open === what ? null : what);
  const setReminders = (part) =>
    onChange({ ...settings, reminders: { ...reminders, ...part } });

  const typeCard = (text) => {
    if (text.length < 4) {
      setDigits(text);
      return;
    }
    // The field goes; without this the keyboard stays up with nothing to type in.
    Keyboard.dismiss();
    setDigits('');
    onChange({ ...settings, cards: addCard(cards, text) });
    setOpen(text);
  };

  const divider = { borderTopColor: colors.cardBorderSoft };
  const label = (text, color = colors.text) => (
    <Text style={[styles.label, { color }]}>{text}</Text>
  );

  return (
    <View style={styles.column}>
      <GlowCard>
        {cards.map((card, i) => (
          <View
            key={card.cardLast4}
            style={i > 0 && [styles.divided, divider]}
            testID={`settings-card-${card.cardLast4}`}
          >
            <View style={styles.row}>
              {label(
                translate('financeSettings.billingDay', {
                  card: cardName(translate, card),
                }),
              )}
              <PillButton
                label={translate('financeSettings.dayOfMonth', {
                  nth: ordinal(translate, card.billingDay),
                })}
                tone={open === card.cardLast4 ? 'accent' : 'muted'}
                onPress={() => toggle(card.cardLast4)}
              />
            </View>
            {open === card.cardLast4 && (
              <>
                <Stepper
                  value={card.billingDay}
                  onChange={(day) =>
                    onChange({
                      ...settings,
                      cards: setBillingDay(cards, card.cardLast4, day),
                    })
                  }
                  min={1}
                  max={31}
                  unit={translate('financeSettings.dayUnit')}
                  testID="billing-day"
                />
                <Pressable
                  onPress={() => setRemoving(card)}
                  accessibilityRole="button"
                  testID="settings-remove-card"
                  style={({ pressed }) => [
                    styles.remove,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.edit, { color: colors.error }]}>
                    {translate('financeSettings.removeCard')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ))}
        <View style={cards.length > 0 && [styles.divided, divider]}>
          <Pressable
            onPress={() => {
              setDigits('');
              toggle('add');
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: open === 'add' }}
            testID="settings-add-card"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            {label(translate('finance.anotherCard'), colors.accent)}
          </Pressable>
          {open === 'add' && (
            <View style={styles.stepper}>
              <CardDigitsField
                value={digits}
                onChange={typeCard}
                cards={usedCards.filter(
                  (last4) => !cards.some((c) => c.cardLast4 === last4),
                )}
                autoFocus
              />
            </View>
          )}
        </View>
        <View style={[styles.divided, divider]}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.remindersTitle, { color: colors.text }]}>
                {translate('financeSettings.reminders')}
              </Text>
              <Text style={[styles.remindersWhat, { color: colors.textMuted }]}>
                {translate('financeSettings.remindersWhat')}
              </Text>
            </View>
            <Switch
              value={reminders.enabled}
              onValueChange={(enabled) => setReminders({ enabled })}
              accessibilityLabel={translate('financeSettings.reminders')}
            />
          </View>
          {reminders.enabled && (
            <View style={[styles.stepper, styles.time]}>
              <Stepper
                value={reminders.hour}
                onChange={(hour) => setReminders({ hour })}
                max={23}
                unit={translate('units.hours')}
                style={styles.flex}
                testID="reminders-hour"
              />
              <Stepper
                value={reminders.minute}
                onChange={(minute) => setReminders({ minute })}
                max={55}
                step={5}
                unit={translate('units.minutes')}
                style={styles.flex}
                testID="reminders-minute"
              />
            </View>
          )}
        </View>
        <Pressable
          onPress={onCategories}
          disabled={!onCategories}
          accessibilityRole="button"
          testID="settings-categories"
          style={({ pressed }) => [
            styles.divided,
            divider,
            styles.row,
            pressed && styles.pressed,
          ]}
        >
          {label(translate('financeSettings.categories'))}
          <Text style={[styles.edit, { color: colors.textMuted }]}>
            {translate('financeSettings.edit')}
          </Text>
        </Pressable>
      </GlowCard>
      <Text style={[styles.note, { color: colors.textMuted }]}>
        {translate('financeSettings.note')}
      </Text>
      <ConfirmModal
        visible={!!removing}
        message={
          removing
            ? translate('financeSettings.confirmRemove', {
                card: cardName(translate, removing),
              })
            : ''
        }
        onConfirm={() => {
          onChange({
            ...settings,
            cards: removeCard(cards, removing.cardLast4),
          });
          setRemoving(null);
          setOpen(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
  },
  divided: { borderTopWidth: StyleSheet.hairlineWidth },
  label: { flex: 1, fontSize: 14 },
  edit: { fontSize: 14 },
  remove: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  remindersTitle: { fontSize: 14 },
  remindersWhat: { fontSize: 12 },
  stepper: { marginBottom: 12 },
  time: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  note: { fontSize: 12, lineHeight: 18 },
});
