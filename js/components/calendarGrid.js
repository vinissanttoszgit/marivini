import { getMonthMatrix, isSameDate, todayISO } from "../utils/dates.js";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function calendarGrid({ currentDate, selectedDate, eventsByDate }) {
  const matrix = getMonthMatrix(currentDate);

  return `
    <div class="calendar-grid">
      ${WEEKDAYS.map((weekday) => `<div class="calendar-grid__weekday">${weekday}</div>`).join("")}
      ${matrix
        .map(({ isoDate, dayNumber, isCurrentMonth }) => {
          const hasEvents = Boolean(eventsByDate[isoDate]?.length);
          const isSelected = isSameDate(isoDate, selectedDate);
          const isToday = isSameDate(isoDate, todayISO());
          return `
            <button
              class="calendar-grid__day ${!isCurrentMonth ? "is-outside" : ""} ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}"
              data-date="${isoDate}"
            >
              <span>${dayNumber}</span>
              <span class="calendar-grid__day-dot" style="${hasEvents ? "" : "opacity:0;"}"></span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}
