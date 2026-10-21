import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../../../shared/components/base/feedback/Alert';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import PillButton from '../../../shared/components/base/buttons/PillButton';
import InputField from '../../../shared/components/base/form/InputField';
import Stepper from '../../../shared/components/base/form/Stepper';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import {
  clearCustomReminderError,
  createCustomReminder,
  deleteCustomReminder,
  editCustomReminderDay,
  skipCustomReminderDay,
  updateCustomReminder,
} from '../store/customRemindersSlice';
import {
  addDay,
  calendarChoices,
  hebrewDateText,
  oddDateNotes,
  repeatLabel,
  shortDate,
  straightenQuotes,
  summaryLine,
  TITLE_MAX_LENGTH,
  titleProblem,
} from '../utils/customReminders';
import { nextDates } from '../utils/occurrences';

const REPEATS = ['once', 'daily', 'monthly', 'yearly'];
const label = (s) => s[0].toUpperCase() + s.slice(1);

// Composite component (BottomSheet/InputField/Stepper/PillButton/GradientButton/Alert) — the add and
// edit sheet for a user's own reminder (mockups 3.6a P2/X1). `target` is { reminder, date }: no
// reminder adds one starting on `date`; a reminder edits it, `date` being the day it was tapped on
// (what "Only this day" means) — the form starts from that day's own title and time if it has
// them (`changed`). Owns its Redux wiring; the form is private, so closing drops it.
// `onSaved(start)` after a save.
export default function CustomReminderSheet({ target, onClose, onSaved }) {
  const dispatch = useDispatch();
  useEffect(() => {
    if (target) dispatch(clearCustomReminderError());
  }, [target, dispatch]);

  return (
    <BottomSheet visible={!!target} onClose={onClose}>
      {target ? (
        <ReminderForm target={target} onClose={onClose} onSaved={onSaved} />
      ) : null}
    </BottomSheet>
  );
}

function ReminderForm({ target, onClose, onSaved }) {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const error = useSelector((s) => s.customReminders.error);
  const original = target.reminder;
  const day = original?.changed[target.date] ?? original;
  const [draft, setDraft] = useState(() => ({
    title: day?.title ?? '',
    hour: day?.hour ?? 19,
    minute: day?.minute ?? 0,
    repeat: original?.repeat ?? 'once',
    calendar: original?.calendar ?? 'gregorian',
    start: original?.start ?? target.date,
  }));
  // 'form', 'confirmDelete', or { kind: 'edit' | 'delete' } — "Only this day or every time?"
  const [step, setStep] = useState('form');
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const timing = {
    hour: draft.hour,
    minute: draft.minute,
    repeat: draft.repeat,
    calendar: draft.calendar,
    start: draft.start,
  };
  const next = useMemo(
    () => nextDates(timing, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `timing` is these fields
    [draft.hour, draft.minute, draft.repeat, draft.calendar, draft.start],
  );

  const problem = titleProblem(draft.title);
  const repeating = original && original.repeat !== 'once';
  // "Only this day" keeps that day where it is: a new date, repeat or calendar is for the series.
  const onlyDayFits =
    !original ||
    (draft.start === original.start &&
      draft.repeat === original.repeat &&
      draft.calendar === original.calendar);
  const input = { ...timing, title: draft.title.trim() };

  const finish = async (action, savedStart) => {
    const result = await dispatch(action);
    if (result.error) {
      setStep('form');
      return;
    }
    if (savedStart) onSaved?.(savedStart);
    onClose();
  };

  const save = () => {
    if (problem) return;
    if (!original) return finish(createCustomReminder(input), input.start);
    if (repeating) return setStep({ kind: 'edit' });
    return finish(
      updateCustomReminder({ id: original.id, patch: input }),
      input.start,
    );
  };
  const remove = () =>
    repeating ? setStep({ kind: 'delete' }) : setStep('confirmDelete');

  if (typeof step === 'object') {
    const isDelete = step.kind === 'delete';
    return (
      <View style={styles.form}>
        <Text style={[styles.title, { color: colors.text }]}>
          {`${isDelete ? 'Delete' : 'Change'} "${original.title}"`}
        </Text>
        <Text style={[styles.muted, { color: colors.textMuted }]}>
          {`It repeats: ${repeatLabel(original).toLowerCase()}.`}
        </Text>
        {error ? <Alert>{error}</Alert> : null}
        <View style={styles.choices}>
          {(isDelete || onlyDayFits) && (
            <GradientButton
              label={`Only ${shortDate(target.date)}`}
              onPress={() =>
                finish(
                  isDelete
                    ? skipCustomReminderDay({
                        id: original.id,
                        date: target.date,
                      })
                    : editCustomReminderDay({
                        id: original.id,
                        date: target.date,
                        input: {
                          title: input.title,
                          hour: input.hour,
                          minute: input.minute,
                        },
                      }),
                  isDelete ? null : target.date,
                )
              }
              contentStyle={styles.actionContent}
            />
          )}
          <GradientButton
            label="Every time"
            variant={isDelete ? 'danger' : 'primary'}
            onPress={() =>
              finish(
                isDelete
                  ? deleteCustomReminder(original.id)
                  : updateCustomReminder({
                      id: original.id,
                      patch: input,
                      date: target.date,
                    }),
                isDelete ? null : input.start,
              )
            }
            contentStyle={styles.actionContent}
          />
          <GradientButton
            label="Cancel"
            onPress={() => setStep('form')}
            contentStyle={styles.actionContent}
          />
        </View>
      </View>
    );
  }

  const choices =
    draft.repeat === 'monthly' || draft.repeat === 'yearly'
      ? calendarChoices(draft)
      : null;

  return (
    <View style={styles.form}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>
          {original ? 'Edit reminder' : 'New reminder'}
        </Text>
        <PillButton label="Close" tone="muted" onPress={onClose} />
      </View>

      <InputField
        label="Title"
        value={draft.title}
        onChangeText={(title) => set({ title: straightenQuotes(title) })}
        placeholder="e.g. Call Grandma"
        autoCapitalize="sentences"
        maxLength={TITLE_MAX_LENGTH}
        showCharCount
        error={draft.title && problem ? problem : undefined}
      />

      <Field label={draft.repeat === 'once' ? 'On' : 'Starts'}>
        <View
          style={[
            styles.date,
            {
              borderColor: colors.cardBorderSoft,
              backgroundColor: colors.inputBg,
            },
          ]}
        >
          <DayArrow
            icon="‹"
            label="Day before"
            onPress={() => set({ start: addDay(draft.start, -1) })}
          />
          <View style={styles.dateMiddle}>
            <Text style={[styles.dateText, { color: colors.text }]}>
              {shortDate(draft.start, true)}
            </Text>
            <Text style={[styles.hebrew, { color: colors.textMuted }]}>
              {hebrewDateText(draft.start)}
            </Text>
          </View>
          <DayArrow
            icon="›"
            label="Day after"
            onPress={() => set({ start: addDay(draft.start, 1) })}
          />
        </View>
      </Field>

      <Field label="Time">
        <View style={styles.row}>
          <Stepper
            value={draft.hour}
            onChange={(hour) => set({ hour })}
            max={23}
            unit="hours"
            style={styles.flex}
          />
          <Stepper
            value={draft.minute}
            onChange={(minute) => set({ minute })}
            max={55}
            step={5}
            unit="min"
            style={styles.flex}
          />
        </View>
      </Field>

      <Field label="Repeats">
        <View style={styles.pills}>
          {REPEATS.map((repeat) => (
            <PillButton
              key={repeat}
              label={label(repeat)}
              tone={draft.repeat === repeat ? 'selected' : 'muted'}
              onPress={() => set({ repeat })}
              style={styles.pill}
            />
          ))}
        </View>
      </Field>

      {choices ? (
        <View style={styles.pills}>
          {['gregorian', 'hebrew'].map((calendar) => (
            <PillButton
              key={calendar}
              label={`${label(calendar)} · ${choices[calendar]}`}
              tone={draft.calendar === calendar ? 'selected' : 'muted'}
              onPress={() => set({ calendar })}
              style={styles.pill}
            />
          ))}
        </View>
      ) : null}

      {oddDateNotes(draft).map((note) => (
        <Alert key={note} variant="warning">
          {note}
        </Alert>
      ))}

      <Summary draft={draft} next={next} />

      {error ? <Alert>{error}</Alert> : null}

      {step === 'confirmDelete' ? (
        <View style={styles.confirm}>
          <Text style={[styles.muted, { color: colors.text }]}>
            {`Delete "${original.title}"?`}
          </Text>
          <View style={styles.row}>
            <GradientButton
              label="Keep"
              onPress={() => setStep('form')}
              style={styles.flex}
              contentStyle={styles.actionContent}
            />
            <GradientButton
              label="Delete"
              variant="danger"
              onPress={() => finish(deleteCustomReminder(original.id), null)}
              style={styles.flex}
              contentStyle={styles.actionContent}
            />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          {original ? (
            <GradientButton
              label="Delete"
              variant="danger"
              onPress={remove}
              style={styles.flex}
              contentStyle={styles.actionContent}
            />
          ) : (
            <GradientButton
              label="Cancel"
              onPress={onClose}
              style={styles.flex}
              contentStyle={styles.actionContent}
            />
          )}
          <GradientButton
            label="Save"
            onPress={save}
            disabled={!!problem}
            style={styles.flex}
            contentStyle={styles.actionContent}
          />
        </View>
      )}
    </View>
  );
}

// What it'll do and the next days it falls on, in both calendars.
function Summary({ draft, next }) {
  const { colors } = useAppTheme();
  const body =
    next.length === 0 ? "That time has passed — it won't go off." : null;
  return (
    <View
      style={[
        styles.summary,
        { borderColor: colors.cardBorderSoft, backgroundColor: colors.card },
      ]}
      accessibilityLabel="Next dates"
    >
      <Text style={[styles.summaryLine, { color: colors.text }]}>
        {summaryLine(draft)}
      </Text>
      {body ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>{body}</Text>
      ) : (
        <>
          {draft.repeat !== 'once' && (
            <Text style={[styles.fieldLabel, { color: colors.textFaint }]}>
              Next
            </Text>
          )}
          {next.map((date) => (
            <View key={date} style={styles.nextRow}>
              <Text style={[styles.nextDate, { color: colors.text }]}>
                {shortDate(date, true)}
              </Text>
              <Text style={[styles.hebrew, { color: colors.textMuted }]}>
                {hebrewDateText(date)}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function Field({ label: text, children }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textFaint }]}>
        {text}
      </Text>
      {children}
    </View>
  );
}

function DayArrow({ icon, label: text, onPress }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={text}
      style={({ pressed }) => [
        styles.arrow,
        { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.arrowText, { color: colors.accent }]}>{icon}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  muted: { fontSize: 13 },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingVertical: 6, paddingHorizontal: 12 },
  date: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 6,
  },
  dateMiddle: { flex: 1, alignItems: 'center' },
  dateText: { fontSize: 14, fontWeight: '600' },
  hebrew: { fontSize: 12.5, writingDirection: 'rtl' },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 20, fontWeight: '700' },
  summary: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  summaryLine: { fontSize: 13.5, fontWeight: '700' },
  nextRow: { flexDirection: 'row', justifyContent: 'space-between' },
  nextDate: { fontSize: 13 },
  choices: { gap: 10 },
  confirm: { gap: 10 },
  actionContent: { paddingVertical: 11 },
});
