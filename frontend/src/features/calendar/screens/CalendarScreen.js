import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import FloatingButton from '../../../shared/components/base/buttons/FloatingButton';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import SwipePager from '../../../shared/components/base/layout/SwipePager';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { locate } from '../../../shared/device/locationSlice';
import { israelIsoDate, monthAt, monthIndex } from '../../../shared/utils/date';
import {
  CustomReminderSheet,
  RemindersSheet,
  remindersRange,
  selectDayReminders,
  setRemindersRange,
} from '../../reminders';
import DayCard from '../components/DayCard';
import MonthGrid, { WeekdayRow } from '../components/MonthGrid';
import MonthHeader from '../components/MonthHeader';
import MonthStatus from '../components/MonthStatus';
import { fetchMonth, loadMonthsAround, PRELOAD } from '../store/calendarSlice';
import {
  hebrewTitle,
  monthTitle,
  openingDate,
  placeholderDays,
} from '../utils/calendar';

// Times and holidays are for the device's location — the same one Home uses. The user's own
// reminders are shown over the loaded months; the + adds one to the selected day.
export default function CalendarScreen() {
  const dispatch = useDispatch();
  const location = useSelector((state) => state.location);
  const months = useSelector((state) => state.calendar.months);
  const dayReminders = useSelector(selectDayReminders);
  const [sheetDate, setSheetDate] = useState(null); // the day whose reminders are all shown
  const [editing, setEditing] = useState(null); // { reminder, date } — the add/edit sheet
  // On every new minute: a once-reminder whose time passes dims, and after midnight "today" moves on.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id;
    const tick = () => {
      id = setTimeout(
        () => {
          setNow(new Date());
          tick();
        },
        60_000 - (Date.now() % 60_000),
      );
    };
    tick();
    return () => clearTimeout(id);
  }, []);
  // Israel's date, whatever the phone's zone — the app is Israel-only.
  const today = israelIsoDate(now);
  const pager = useRef(null);
  const thisMonth = monthIndex({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  });
  // `shown` is the month landed on; `inView` the one mostly in view mid-swipe (the title).
  const [shown, setShown] = useState(thisMonth);
  const [inView, setInView] = useState(shown);
  // The day on the card: today in this month, the 1st in any other, or the one tapped.
  const [selected, setSelected] = useState(today);

  const land = (index) => {
    setInView(index);
    if (index === shown) return;
    setShown(index);
    setSelected(openingDate(monthAt(index), today));
  };

  // Home finds the location on start; opened straight to this tab, nothing has asked yet.
  useEffect(() => {
    if (location.status === 'idle') dispatch(locate());
  }, [location.status, dispatch]);

  // The month landed on and one either side: a swipe lands on a month that's already there.
  useEffect(() => {
    if (location.coords) dispatch(loadMonthsAround(monthAt(shown)));
  }, [shown, location.coords, dispatch]);

  // The user's reminders over the same months (they don't need a location).
  useEffect(() => {
    dispatch(setRemindersRange(remindersRange(shown, PRELOAD)));
  }, [shown, dispatch]);

  const add = () => setEditing({ reminder: null, date: selected });
  const edit = (date) => (row) => {
    setSheetDate(null);
    setEditing({ reminder: row.reminder, date });
  };
  // A new or moved reminder in the month on screen when the save lands: show its day.
  const shownNow = useRef(shown);
  shownNow.current = shown;
  const showSaved = (start) => {
    const [year, month] = start.split('-').map(Number);
    if (monthIndex({ year, month }) === shownNow.current) setSelected(start);
  };

  const days = months[shown]?.days ?? null;
  const shownStatus = months[shown]?.status;
  const inViewDays = months[inView]?.days;
  const awayFromToday =
    shown !== thisMonth || inView !== thisMonth || selected !== today;
  // Always both: a slide may still be on its way somewhere (quick arrow taps), so `shown` alone
  // can't tell whether we're already there.
  const goToToday = () => {
    setSelected(today);
    pager.current?.goTo(thisMonth);
  };
  const selectedDay = days?.find((d) => d.date === selected) ?? null;
  const problem =
    !days &&
    (shownStatus === 'failed' ||
      (!location.coords && ['denied', 'failed'].includes(location.status)));

  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <GlowCard style={styles.panel}>
          <MonthHeader
            title={monthTitle(monthAt(inView))}
            hebrewTitle={inViewDays ? hebrewTitle(inViewDays) : null}
            onPrevious={() => pager.current?.go(-1)}
            onNext={() => pager.current?.go(1)}
            onToday={awayFromToday ? goToToday : undefined}
          />
          <WeekdayRow />
          <SwipePager
            ref={pager}
            index={shown}
            onMove={setInView}
            onSettle={land}
            renderPage={(i) => (
              <MonthGrid
                days={months[i]?.days ?? placeholderDays(i)}
                today={today}
                selected={i === shown ? selected : null}
                onSelect={setSelected}
                weekdays={false}
                reminders={dayReminders}
              />
            )}
          />
          {problem && (
            <MonthStatus
              locationStatus={location.status}
              hasLocation={!!location.coords}
              loadFailed={shownStatus === 'failed'}
              onRetry={() =>
                location.coords
                  ? dispatch(fetchMonth(monthAt(shown)))
                  : dispatch(locate())
              }
            />
          )}
        </GlowCard>
        {/* Dimmed while a swipe is between months; it lands on the new month's day. */}
        <View style={[styles.cardBox, { opacity: inView === shown ? 1 : 0.3 }]}>
          {selectedDay && (
            <DayCard
              day={selectedDay}
              isToday={selectedDay.date === today}
              reminders={dayReminders[selectedDay.date] ?? []}
              now={now}
              onShowAll={() => setSheetDate(selectedDay.date)}
              onPressReminder={edit(selectedDay.date)}
            />
          )}
        </View>
      </ScrollView>
      <FloatingButton
        accessibilityLabel="Add reminder"
        onPress={add}
        style={styles.fab}
      />
      <RemindersSheet
        date={sheetDate}
        reminders={dayReminders[sheetDate] ?? []}
        now={now}
        onClose={() => setSheetDate(null)}
        onPressReminder={edit(sheetDate)}
      />
      <CustomReminderSheet
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={showSaved}
      />
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 96, // the last reminder scrolls clear of the +
  },
  fab: { position: 'absolute', right: 20, bottom: 20 },
  panel: { width: '100%', maxWidth: 420 },
  cardBox: { width: '100%', maxWidth: 420, alignItems: 'center' },
});
