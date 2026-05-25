export function todayISO() {
  return new Date().toLocaleDateString("en-CA");
}

export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function parseISODate(isoDate) {
  return new Date(`${isoDate}T12:00:00`);
}

export function startOfDayISO(date) {
  return new Date(date).toLocaleDateString("en-CA");
}

export function endOfDayISO(date) {
  return new Date(date).toLocaleDateString("en-CA");
}

export function isSameDate(left, right) {
  return left === right;
}

export function getWeekdayIndex(isoDate) {
  return parseISODate(isoDate).getDay();
}

export function shiftMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function formatMonthYear(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatLongDate(isoDate) {
  const date = parseISODate(isoDate);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

export function formatHabitDateLabel(isoDate) {
  if (isSameDate(isoDate, todayISO())) {
    return "Hoje";
  }

  if (isSameDate(isoDate, startOfDayISO(addDays(new Date(), -1)))) {
    return "Ontem";
  }

  if (isSameDate(isoDate, startOfDayISO(addDays(new Date(), 1)))) {
    return "Amanhã";
  }

  return formatLongDate(isoDate);
}

export function formatTimeLabel(value) {
  return value.slice(0, 5);
}

export function formatReminderLabel(minutes) {
  const amount = Number(minutes);
  if (amount === 60) {
    return "1 hora antes";
  }
  return `${amount} min antes`;
}

export function getCalendarMonthBounds(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    startDate: firstDay.toLocaleDateString("en-CA"),
    endDate: lastDay.toLocaleDateString("en-CA")
  };
}

export function endOfMonthISO(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toLocaleDateString("en-CA");
}

export function getMonthMatrix(date) {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const startDay = new Date(firstDayOfMonth);
  startDay.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const current = addDays(startDay, index);
    return {
      isoDate: current.toLocaleDateString("en-CA"),
      dayNumber: current.getDate(),
      isCurrentMonth: current.getMonth() === date.getMonth()
    };
  });
}
