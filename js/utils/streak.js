import { addDays } from "./dates.js";

function isoFromDate(date) {
  return date.toLocaleDateString("en-CA");
}

export function calculateHabitStatus(logs, referenceDate) {
  const completedDates = new Set(logs.filter((log) => log.completed).map((log) => log.log_date));
  const today = new Date(`${referenceDate}T12:00:00`);
  const yesterday = isoFromDate(addDays(today, -1));
  const todayCompleted = completedDates.has(referenceDate);
  const missedYesterday = !completedDates.has(yesterday);
  const missedTwoDaysRisk = missedYesterday && !todayCompleted;

  let currentStreak = 0;
  let cursor = todayCompleted ? today : addDays(today, -1);

  while (completedDates.has(isoFromDate(cursor))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
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
