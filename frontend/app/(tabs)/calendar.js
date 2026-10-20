import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import FloatingButton from '../../src/components/base/buttons/FloatingButton';
import GlowCard from '../../src/components/base/layout/GlowCard';
import SwipePager from '../../src/components/base/layout/SwipePager';
import AmbientBackground from '../../src/components/composite/AmbientBackground';
import ConfirmModal from '../../src/components/composite/ConfirmModal';
import CustomReminderSheet from '../../src/components/composite/CustomReminderSheet';
import DayCard from '../../src/components/composite/DayCard';
import MonthGrid, {
  WeekdayRow,
} from '../../src/components/composite/MonthGrid';
import MonthHeader from '../../src/components/composite/MonthHeader';
import MonthStatus from '../../src/components/composite/MonthStatus';
import RemindersSheet from '../../src/components/composite/RemindersSheet';
import { selectUserId } from '../../src/store/slices/authSlice';
import {
  fetchMonth,
  loadMonthsAround,
  PRELOAD,
} from '../../src/store/slices/calendarSlice';
import {
  fetchCustomReminders,
  selectDayReminders,
} from '../../src/store/slices/customRemindersSlice';
import { locate } from '../../src/store/slices/locationSlice';
import {
  hebrewTitle,
  israelIsoDate,
  monthAt,
  monthIndex,
  monthTitle,
  openingDate,
  placeholderDays,
} from '../../src/utils/calendar';
import { remindersRange } from '../../src/utils/customReminders';

// Times and holidays are for the device's location — the same one Home uses. The user's own
// reminders (signed in) are fetched for the loaded months; the + adds one to the selected day.
export default function CalendarScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const location = useSelector((state) => state.location);
  const months = useSelector((state) => state.calendar.months);
  const userId = useSelector(selectUserId);
  const dayReminders = useSelector(selectDayReminders);
  const [sheetDate, setSheetDate] = useState(null); // the day whose reminders are all shown
  const [editing, setEditing] = useState(null); // { reminder, date } — the add/edit sheet
  const [askLogin, setAskLogin] = useState(false);
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

  // The month landed on and two either side: a swipe lands on a month that's already there.
  useEffect(() => {
    if (location.coords) dispatch(loadMonthsAround(monthAt(shown)));
  }, [shown, location.coords, dispatch]);

  // The user's reminders over the same months (they don't need a location).
  useEffect(() => {
    if (userId) dispatch(fetchCustomReminders(remindersRange(shown, PRELOAD)));
  }, [shown, userId, dispatch]);

  // Signing out closes the add/edit sheet (it needs a session).
  useEffect(() => {
    if (!userId) setEditing(null);
  }, [userId]);

  const add = () =>
    userId ? setEditing({ reminder: null, date: selected }) : setAskLogin(true);
  const edit = (date) => (row) => {
    setSheetDate(null);
    setEditing({ reminder: row.reminder, date });
  };
  // A new or moved reminder in the month on screen when the save lands (not when it started — the
  // months may have moved meanwhile): show its day.
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
      <ConfirmModal
        visible={askLogin}
        message="Log in to add reminders?"
        onConfirm={() => {
          setAskLogin(false);
          router.push('/login');
        }}
        onCancel={() => setAskLogin(false)}
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
