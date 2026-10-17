import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import GlowCard from '../../src/components/base/layout/GlowCard';
import SwipePager from '../../src/components/base/layout/SwipePager';
import AmbientBackground from '../../src/components/composite/AmbientBackground';
import DayCard from '../../src/components/composite/DayCard';
import MonthGrid, {
  WeekdayRow,
} from '../../src/components/composite/MonthGrid';
import MonthHeader from '../../src/components/composite/MonthHeader';
import MonthStatus from '../../src/components/composite/MonthStatus';
import RemindersSheet from '../../src/components/composite/RemindersSheet';
import {
  fetchMonth,
  loadMonthsAround,
} from '../../src/store/slices/calendarSlice';
import { locate } from '../../src/store/slices/locationSlice';
import {
  hebrewTitle,
  localIsoDate,
  monthAt,
  monthIndex,
  monthTitle,
  openingDate,
  placeholderDays,
} from '../../src/utils/calendar';

// Times and holidays are for the device's location — the same one Home uses.
export default function CalendarScreen() {
  const dispatch = useDispatch();
  const location = useSelector((state) => state.location);
  const months = useSelector((state) => state.calendar.months);
  const dayReminders = useSelector((state) => state.calendar.dayReminders);
  const [sheetDate, setSheetDate] = useState(null); // the day whose reminders are all shown
  const [now] = useState(() => new Date());
  const today = localIsoDate(now);
  const pager = useRef(null);
  const thisMonth = monthIndex({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
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
              onShowAll={() => setSheetDate(selectedDay.date)}
            />
          )}
        </View>
      </ScrollView>
      <RemindersSheet
        date={sheetDate}
        reminders={dayReminders[sheetDate] ?? []}
        onClose={() => setSheetDate(null)}
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
  },
  panel: { width: '100%', maxWidth: 420 },
  cardBox: { width: '100%', maxWidth: 420, alignItems: 'center' },
});
