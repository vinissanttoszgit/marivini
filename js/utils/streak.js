import { addDays, getWeekdayIndex, parseISODate } from "./dates.js";

function isoFromDate(date) {
  return date.toLocaleDateString("en-CA");
}

function normalizeActiveDays(activeDays) {
  return Array.isArray(activeDays) && activeDays.length ? activeDays.map(Number) : [1, 2, 3, 4, 5, 6, 0];
}

function getOccurrenceKey(occurrence) {
  return `${occurrence.habitId}:${occurrence.scheduledDate}`;
}

function getScheduledOccurrences({ habit, referenceDate, overrides = [], lookbackDays = 60 }) {
  const activeDays = normalizeActiveDays(habit?.active_days);
  const habitId = String(habit?.id ?? "");
  const reference = parseISODate(referenceDate);
  const start = addDays(reference, -lookbackDays);
  const overridesByOriginalDate = new Map(
    overrides
      .filter((override) => String(override.habit_id) === habitId)
      .map((override) => [override.original_date, override])
  );
  const occurrences = [];

  for (let cursor = start; cursor <= reference; cursor = addDays(cursor, 1)) {
    const scheduledDate = isoFromDate(cursor);
    const override = overridesByOriginalDate.get(scheduledDate);

    if (activeDays.includes(getWeekdayIndex(scheduledDate)) && (!override || override.target_date === scheduledDate)) {
      occurrences.push({
        habitId,
        originalDate: scheduledDate,
        scheduledDate,
        isPostponed: false
      });
    }
  }

  overrides
    .filter((override) => String(override.habit_id) === habitId && override.target_date <= referenceDate)
    .forEach((override) => {
      occurrences.push({
        habitId,
        originalDate: override.original_date,
        scheduledDate: override.target_date,
        isPostponed: true
      });
    });

  return [...new Map(occurrences.map((occurrence) => [getOccurrenceKey(occurrence), occurrence])).values()]
    .sort((left, right) => {
      const scheduledDiff = String(left.scheduledDate).localeCompare(String(right.scheduledDate));
      if (scheduledDiff !== 0) {
        return scheduledDiff;
      }

      return String(left.originalDate).localeCompare(String(right.originalDate));
    });
}

export function calculateHabitStatus(logs, referenceDate, { habit = null, overrides = [] } = {}) {
  const completedDates = new Set(logs.filter((log) => log.completed).map((log) => log.log_date));
  const occurrences = habit
    ? getScheduledOccurrences({ habit, referenceDate, overrides })
    : [{ scheduledDate: referenceDate, originalDate: referenceDate, habitId: String(logs[0]?.habit_id ?? "") }];
  const currentOccurrence = [...occurrences].reverse().find(
    (occurrence) => occurrence.scheduledDate <= referenceDate
  );
  const currentIndex = currentOccurrence ? occurrences.indexOf(currentOccurrence) : -1;
  const previousOccurrence = currentIndex > 0 ? occurrences[currentIndex - 1] : null;
  const todayCompleted = completedDates.has(referenceDate);
  const missedYesterday = previousOccurrence ? !completedDates.has(previousOccurrence.scheduledDate) : false;
  const missedTwoDaysRisk = Boolean(previousOccurrence && missedYesterday && !todayCompleted);

  let currentStreak = 0;
  let cursorIndex = todayCompleted ? currentIndex : currentIndex - 1;

  while (cursorIndex >= 0 && completedDates.has(occurrences[cursorIndex].scheduledDate)) {
    currentStreak += 1;
    cursorIndex -= 1;
  }

  let statusLabel = "No ritmo";
  if (missedTwoDaysRisk) {
    statusLabel = "Nao falhe hoje";
  }

  return {
    currentStreak,
    missedYesterday,
    missedTwoDaysRisk,
    statusLabel
  };
}
