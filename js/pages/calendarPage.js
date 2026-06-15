import eventsService from "../services/eventsService.js";
import { button } from "../components/button.js";
import { calendarGrid } from "../components/calendarGrid.js";
import { emptyState } from "../components/emptyState.js";
import { eventCard } from "../components/eventCard.js";
import { loadingState } from "../components/loadingState.js";
import { selectionActionBar } from "../components/selectionActionBar.js";
import {
  formatLongDate,
  formatTimeLabel,
  formatMonthYear,
  getCalendarMonthBounds,
  getMonthMatrix,
  isSameDate,
  shiftMonth,
  todayISO
} from "../utils/dates.js";
import { validateRequired } from "../utils/validators.js";

const LONG_PRESS_MS = 500;
const POINTER_CANCEL_DISTANCE = 10;
const PENDING_EVENTS_LIMIT = 20;
const CALENDAR_PRELOAD_RADIUS = 2;
const TIME_SLOT_STEP_MINUTES = 15;

const EVENT_EMOJI_OPTIONS = ["🗓️", "💼", "❤️", "🏠", "🎂", "🩺", "💸", "📞", "✈️", "🛒", "🎯", "🏊", "🏀", "🏐", "⚽", "🎾"];

const REMINDER_OPTIONS = [
  { value: "", label: "Sem lembrete" },
  { value: "5", label: "5 minutos antes" },
  { value: "15", label: "15 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" }
];

export function createCalendarPage(context) {
  const state = {
    currentMonth: new Date(),
    selectedDate: todayISO(),
    isMonthLoading: false,
    isPendingLoading: false,
    monthlyEvents: [],
    pendingEvents: [],
    selectedEventIds: [],
    selectionMode: false
  };

  const monthCache = new Map();
  const pendingMonthRequests = new Map();
  let iconPickerCleanup = null;
  let eventDateTimePickerCleanup = null;
  let consumedLongPressEventId = null;
  let consumedLongPressUntil = 0;
  let renderedCalendarCacheKey = null;

  function getMonthCacheKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function getCalendarVisibilityCacheKey() {
    const viewContext = context.getViewContext();
    const ownUserId = String(viewContext.ownUserId ?? "");
    const sharedCalendarOwnerIds = (viewContext.activeView?.can_view_calendar ? [viewContext.activeView.owner_user_id] : [])
      .filter((userId) => String(userId) !== ownUserId)
      .map((userId) => String(userId))
      .sort();

    return [ownUserId, ...sharedCalendarOwnerIds].join("|");
  }

  function syncSelectedDateWithCurrentMonth() {
    const selectedDay = Number(String(state.selectedDate).split("-")[2]) || 1;
    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const nextDay = Math.min(selectedDay, lastDayOfMonth);

    state.selectedDate = new Date(year, month, nextDay).toLocaleDateString("en-CA");
  }

  function getSelectionSet() {
    return new Set(state.selectedEventIds.map(String));
  }

  function clearSelection() {
    state.selectionMode = false;
    state.selectedEventIds = [];
  }

  function consumeLongPressClick(eventId) {
    consumedLongPressEventId = String(eventId);
    consumedLongPressUntil = Date.now() + 400;
  }

  function shouldIgnoreLongPressClick(eventId) {
    const matchesTarget = consumedLongPressEventId === String(eventId);
    const isActive = Date.now() < consumedLongPressUntil;

    if (matchesTarget && isActive) {
      consumedLongPressEventId = null;
      consumedLongPressUntil = 0;
      return true;
    }

    if (!isActive) {
      consumedLongPressEventId = null;
      consumedLongPressUntil = 0;
    }

    return false;
  }

  function sortEvents(events) {
    return [...events].sort((left, right) => {
      const dateDiff = String(left.event_date ?? "").localeCompare(String(right.event_date ?? ""));
      if (dateDiff !== 0) {
        return dateDiff;
      }

      const timeDiff = String(left.event_time ?? "").localeCompare(String(right.event_time ?? ""));
      if (timeDiff !== 0) {
        return timeDiff;
      }

      const createdAtDiff = String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""));
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return String(left.id ?? "").localeCompare(String(right.id ?? ""));
    });
  }

  function dedupeEvents(events) {
    const seenIds = new Set();
    return events.filter((event) => {
      const normalizedId = String(event.id);
      if (seenIds.has(normalizedId)) {
        return false;
      }

      seenIds.add(normalizedId);
      return true;
    });
  }

  function getAllKnownEvents() {
    return dedupeEvents(sortEvents([...state.monthlyEvents, ...state.pendingEvents]));
  }

  function getEventsByDate() {
    return sortEvents(state.monthlyEvents).reduce((accumulator, event) => {
      accumulator[event.event_date] = accumulator[event.event_date] || [];
      accumulator[event.event_date].push(event);
      return accumulator;
    }, {});
  }

  function getSelectedDateEvents() {
    return sortEvents(state.monthlyEvents.filter((event) => event.event_date === state.selectedDate));
  }

  function getUpcomingEvents() {
    const selectedEventIds = new Set(getSelectedDateEvents().map((event) => String(event.id)));
    const startDate = todayISO();

    return sortEvents(
      state.pendingEvents.filter((event) => {
        return event.event_date >= startDate && !selectedEventIds.has(String(event.id));
      })
    );
  }

  function getUpcomingEventGroups() {
    const currentDate = new Date(`${todayISO()}T12:00:00`);
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

    return getUpcomingEvents().reduce((groups, event) => {
      const [year, month] = String(event.event_date).split("-");
      const monthKey = `${year}-${month}`;
      const monthDate = new Date(Number(year), Number(month) - 1, 1);
      let title = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(monthDate);
      if (monthKey === currentMonthKey) {
        title = "Este mês";
      } else if (monthKey === nextMonthKey) {
        title = "Próximo mês";
      }

      const existingGroup = groups.find((group) => group.key === monthKey);
      if (existingGroup) {
        existingGroup.events.push(event);
        return groups;
      }

      groups.push({
        key: monthKey,
        title,
        events: [event]
      });

      return groups;
    }, []);
  }

  async function fetchMonthEvents(date) {
    const { startDate, endDate } = getCalendarMonthBounds(date);
    return sortEvents(await eventsService.listEventsByMonth({ startDate, endDate }));
  }

  function clearMonthCaches() {
    monthCache.clear();
    pendingMonthRequests.clear();
  }

  function ensureMonthData(date, { preferCache = true } = {}) {
    const monthKey = getMonthCacheKey(date);

    if (preferCache && monthCache.has(monthKey)) {
      return Promise.resolve([...monthCache.get(monthKey)]);
    }

    if (pendingMonthRequests.has(monthKey)) {
      return pendingMonthRequests.get(monthKey);
    }

    const request = fetchMonthEvents(date)
      .then((events) => {
        monthCache.set(monthKey, events);
        return [...events];
      })
      .finally(() => {
        if (pendingMonthRequests.get(monthKey) === request) {
          pendingMonthRequests.delete(monthKey);
        }
      });

    pendingMonthRequests.set(monthKey, request);
    return request;
  }

  async function loadMonth({ preferCache = true } = {}) {
    state.monthlyEvents = await ensureMonthData(state.currentMonth, { preferCache });
  }

  async function loadPendingEvents() {
    state.pendingEvents = sortEvents(
      await eventsService.listPendingEvents({
        startDate: todayISO(),
        limit: PENDING_EVENTS_LIMIT
      })
    );
  }

  function preloadAdjacentMonths() {
    for (let offset = -CALENDAR_PRELOAD_RADIUS; offset <= CALENDAR_PRELOAD_RADIUS; offset += 1) {
      if (offset === 0) {
        continue;
      }

      const monthDate = shiftMonth(state.currentMonth, offset);
      ensureMonthData(monthDate, { preferCache: true }).catch(() => {
        // Ignora falhas de preload para nao interferir na navegacao principal.
      });
    }
  }

  async function refreshCalendarData(root, { preferCache = true, reloadPending = true } = {}) {
    state.isMonthLoading = true;
    state.isPendingLoading = reloadPending;
    refreshContent(root);

    await loadMonth({ preferCache });
    state.isMonthLoading = false;
    refreshContent(root);
    preloadAdjacentMonths();

    if (reloadPending) {
      await loadPendingEvents();
      state.isPendingLoading = false;
      refreshContent(root);
    }
  }

  async function changeMonth(root, amount) {
    const previousMonth = state.currentMonth;
    const previousSelectedDate = state.selectedDate;

    clearSelection();
    state.currentMonth = shiftMonth(state.currentMonth, amount);
    syncSelectedDateWithCurrentMonth();

    try {
      await refreshCalendarData(root, { preferCache: true, reloadPending: false });
    } catch (error) {
      state.currentMonth = previousMonth;
      state.selectedDate = previousSelectedDate;
      context.toast.error(error.message || "Não foi possível carregar este mês.");
    }
  }

  async function resetCurrentMonth(root) {
    const currentMonth = new Date();

    if (getMonthCacheKey(state.currentMonth) === getMonthCacheKey(currentMonth)) {
      return;
    }

    clearSelection();
    state.currentMonth = currentMonth;
    state.selectedDate = todayISO();

    try {
      await refreshCalendarData(root, { preferCache: true, reloadPending: false });
    } catch (error) {
      context.toast.error(error.message || "NÃ£o foi possÃ­vel voltar para o mÃªs atual.");
    }
  }

  async function render(root) {
    const calendarCacheKey = getCalendarVisibilityCacheKey();
    if (renderedCalendarCacheKey !== calendarCacheKey) {
      clearMonthCaches();
      clearSelection();
      renderedCalendarCacheKey = calendarCacheKey;
    }

    context.setHeader({
      eyebrow: "",
      title: "Calendário",
      subtitle: ""
    });

    root.innerHTML = loadingState({ variant: "calendar" });
    state.isMonthLoading = true;
    state.isPendingLoading = true;

    try {
      await refreshCalendarData(root, { preferCache: true, reloadPending: true });
    } catch (error) {
      context.toast.error(error.message || "Não foi possível carregar o calendário.");
      root.innerHTML = emptyState({
        icon: "🗓️",
        title: "Calendário indisponível",
        description: "Confira as credenciais do Supabase e tente novamente."
      });
    }
  }

  function getSelectionBarMarkup() {
    if (!state.selectionMode || context.isReadOnly()) {
      return "";
    }

    return selectionActionBar({
      ariaLabel: "Ações dos eventos selecionados",
      className: "event-selection-floating-bar",
      cancelLabel: "Cancelar",
      cancelId: "cancel-event-selection",
      deleteLabel: `Excluir ${state.selectedEventIds.length}`,
      deleteId: "delete-selected-events",
      deleteDisabled: !state.selectedEventIds.length
    });
  }

  function getMarkup() {
    if (state.isMonthLoading) {
      return loadingState({ variant: "calendar" });
    }

    const canEdit = !context.isReadOnly();
    const eventsByDate = getEventsByDate();
    const selectedEvents = getSelectedDateEvents();
    const upcomingEventGroups = getUpcomingEventGroups();
    const selectionSet = getSelectionSet();

    return `
      <div class="page-stack ${state.selectionMode && canEdit ? "page-stack--selection-mode" : ""}">
        <section class="card calendar-card">
          <div class="calendar-header">
            <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--prev" id="prev-month" aria-label="MÃªs anterior"></button>
            <button class="calendar-header__label calendar-header__label-button" id="reset-calendar-month" type="button" aria-label="Voltar para o mÃªs atual">${formatMonthYear(state.currentMonth)}</button>
            <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--next" id="next-month" aria-label="PrÃ³ximo mÃªs"></button>
          </div>
          ${calendarGrid({ currentDate: state.currentMonth, selectedDate: state.selectedDate, eventsByDate })}
        </section>

        ${
          selectedEvents.length
            ? `<section class="events-list">${selectedEvents
                .map((event) =>
                  eventCard(event, {
                    isSelectionMode: state.selectionMode && canEdit,
                    isSelected: canEdit && selectionSet.has(String(event.id)),
                    canEdit
                  })
                )
                .join("")}</section>`
            : ""
        }

        ${
          upcomingEventGroups.length
            ? `
              ${upcomingEventGroups
                .map(
                  (group) => `
                    <section class="events-upcoming">
                      <div class="events-section-divider">
                        <span>${group.title}</span>
                      </div>
                      <div class="events-list">
                        ${group.events
                          .map((event) =>
                            eventCard(event, {
                              isSelectionMode: state.selectionMode && canEdit,
                              isSelected: canEdit && selectionSet.has(String(event.id)),
                              showDate: true,
                              canEdit
                            })
                          )
                          .join("")}
                      </div>
                    </section>
                  `
                )
                .join("")}
            `
            : state.isPendingLoading
              ? getUpcomingEventsLoadingMarkup()
              : ""
        }
      </div>
      ${getSelectionBarMarkup()}
    `;
  }
  function getUpcomingEventsLoadingMarkup() {
    return `
      <section class="loading-state__calendar-section" aria-label="Carregando proximos eventos">
        <div class="events-section-divider loading-state__calendar-divider">
          <span>Próximos eventos</span>
        </div>
        <div class="events-list">
          ${Array.from(
            { length: 2 },
            () => `
              <article class="card event-card loading-state__event-card">
                <div class="event-card__top">
                  <div class="event-card__body">
                    <div class="loading-state__event-icon"></div>
                    <div class="event-card__content">
                      <div class="loading-state__line loading-state__line--event-title"></div>
                      <div class="loading-state__event-meta">
                        <div class="loading-state__line loading-state__line--event-date"></div>
                        <div class="loading-state__line loading-state__line--event-time"></div>
                      </div>
                    </div>
                  </div>
                  <div class="loading-state__event-action"></div>
                </div>
              </article>
            `
          ).join("")}
        </div>
      </section>
    `;
  }

  function refreshContent(root = context.root) {
    root.innerHTML = getMarkup();
    bind(root);
  }

  function toggleSelection(eventId) {
    const selectionSet = getSelectionSet();
    const normalizedId = String(eventId);

    if (selectionSet.has(normalizedId)) {
      selectionSet.delete(normalizedId);
    } else {
      selectionSet.add(normalizedId);
    }

    state.selectedEventIds = [...selectionSet];

    if (!state.selectedEventIds.length) {
      clearSelection();
    }
  }

  function enterSelectionMode(eventId) {
    state.selectionMode = true;
    state.selectedEventIds = [String(eventId)];
  }

  function bindSelectionBar(root) {
    if (context.isReadOnly()) {
      return;
    }

    root.querySelector("#cancel-event-selection")?.addEventListener("click", () => {
      clearSelection();
      refreshContent(root);
    });

    root.querySelector("#delete-selected-events")?.addEventListener("click", () => {
      if (state.selectedEventIds.length) {
        openDeleteEventsModal(state.selectedEventIds, root);
      }
    });
  }

  function bind(root) {
    const prevMonthButton = root.querySelector("#prev-month");
    const nextMonthButton = root.querySelector("#next-month");

    if (!prevMonthButton || !nextMonthButton) {
      return;
    }

    prevMonthButton.addEventListener("click", async () => {
      await changeMonth(root, -1);
    });

    nextMonthButton.addEventListener("click", async () => {
      await changeMonth(root, 1);
    });

    root.querySelector("#reset-calendar-month")?.addEventListener("click", async () => {
      await resetCurrentMonth(root);
    });

    root.querySelectorAll("[data-date]").forEach((buttonElement) => {
      buttonElement.addEventListener("click", () => {
        clearSelection();
        state.selectedDate = buttonElement.dataset.date;
        refreshContent(root);
      });
    });

    root.querySelectorAll("[data-action='edit-event']").forEach((element) => {
      element.addEventListener("click", (event) => {
        if (context.isReadOnly()) {
          return;
        }

        event.stopPropagation();

        const eventItem = getAllKnownEvents().find(
          (item) => String(item.id) === String(element.dataset.id)
        );

        if (eventItem) {
          openEventModal(eventItem);
        }
      });
    });

    if (context.isReadOnly()) {
      clearSelection();
      return;
    }

    bindSelectionBar(root);
    root.querySelectorAll("[data-event-id]").forEach((element) => bindEventCard(root, element));
  }

  function bindEventCard(root, element) {
    if (context.isReadOnly()) {
      return;
    }

    const eventId = String(element.dataset.eventId);
    let pressTimer = null;
    let pointerSession = null;

    const clearPressTimer = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const cleanupSession = () => {
      clearPressTimer();

      if (pointerSession?.pointerId !== undefined && element.hasPointerCapture?.(pointerSession.pointerId)) {
        element.releasePointerCapture(pointerSession.pointerId);
      }

      pointerSession = null;
    };

    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("[data-action='edit-event']")) {
        return;
      }

      pointerSession = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        longPressFired: false
      };

      element.setPointerCapture?.(event.pointerId);

      clearPressTimer();
      pressTimer = setTimeout(() => {
        if (!pointerSession || pointerSession.pointerId !== event.pointerId) {
          return;
        }

        pointerSession.longPressFired = true;
        consumeLongPressClick(eventId);

        if (!state.selectionMode) {
          enterSelectionMode(eventId);
        } else if (!getSelectionSet().has(eventId)) {
          toggleSelection(eventId);
        }

        refreshContent(root);
      }, LONG_PRESS_MS);
    });

    element.addEventListener("pointermove", (event) => {
      if (!pointerSession || pointerSession.pointerId !== event.pointerId) {
        return;
      }

      const movedX = Math.abs(event.clientX - pointerSession.startX);
      const movedY = Math.abs(event.clientY - pointerSession.startY);

      if (movedX > POINTER_CANCEL_DISTANCE || movedY > POINTER_CANCEL_DISTANCE) {
        clearPressTimer();
      }
    });

    element.addEventListener("pointerup", (event) => {
      if (!pointerSession || pointerSession.pointerId !== event.pointerId) {
        return;
      }

      if (pointerSession.longPressFired) {
        event.preventDefault();
      }

      cleanupSession();
    });

    element.addEventListener("pointercancel", () => {
      cleanupSession();
    });

    element.addEventListener("click", (event) => {
      if (event.target.closest("[data-action='edit-event']")) {
        return;
      }

      if (shouldIgnoreLongPressClick(eventId)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (!state.selectionMode) {
        return;
      }

      toggleSelection(eventId);
      refreshContent(root);
    });
  }

  function bindIconPicker() {
    iconPickerCleanup?.();

    const trigger = document.querySelector("#event-icon-trigger");
    const picker = document.querySelector("#event-icon-picker");
    const hiddenInput = document.querySelector('#event-form input[name="icon"]');
    const preview = document.querySelector("#selected-event-icon");
    const group = document.querySelector(".event-title-group");

    if (!trigger || !picker || !hiddenInput || !preview || !group) {
      iconPickerCleanup = null;
      return;
    }

    const setExpanded = (expanded) => {
      picker.hidden = !expanded;
      trigger.setAttribute("aria-expanded", String(expanded));
    };

    const handleDocumentClick = (event) => {
      if (!group.contains(event.target)) {
        setExpanded(false);
      }
    };

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setExpanded(picker.hidden);
    });

    picker.querySelectorAll("[data-icon]").forEach((option) => {
      option.addEventListener("click", () => {
        const icon = option.dataset.icon || "🗓️";
        hiddenInput.value = icon;
        preview.textContent = icon;

        picker.querySelectorAll(".event-icon-option").forEach((buttonElement) => {
          buttonElement.classList.toggle("is-selected", buttonElement === option);
        });

        setExpanded(false);
      });
    });

    document.addEventListener("click", handleDocumentClick);
    iconPickerCleanup = () => {
      document.removeEventListener("click", handleDocumentClick);
      iconPickerCleanup = null;
    };
  }

  function getEventDateLabel(value) {
    if (!value) {
      return "Selecionar data";
    }

    return formatLongDate(value);
  }

  function getEventTimeLabel(value) {
    if (!value) {
      return "Sem horario";
    }

    return formatTimeLabel(value);
  }

  function getHourOptions() {
    return Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  }

  function getMinuteOptions() {
    return Array.from({ length: 60 / TIME_SLOT_STEP_MINUTES }, (_, index) =>
      String(index * TIME_SLOT_STEP_MINUTES).padStart(2, "0")
    );
  }

  function getDatePickerMarkup(selectedDate) {
    const currentDate = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date(`${state.selectedDate}T12:00:00`);
    const matrix = getMonthMatrix(currentDate);

    return `
      <div class="event-date-picker" id="event-date-picker" hidden>
        <div class="event-date-picker__header">
          <button type="button" class="icon-button habit-date-nav__arrow habit-date-nav__arrow--prev" id="event-date-picker-prev" aria-label="Mes anterior"></button>
          <div class="event-date-picker__month">${formatMonthYear(currentDate)}</div>
          <button type="button" class="icon-button habit-date-nav__arrow habit-date-nav__arrow--next" id="event-date-picker-next" aria-label="Proximo mes"></button>
        </div>
        <div class="event-date-picker__grid">
          ${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((weekday) => `<div class="event-date-picker__weekday">${weekday}</div>`).join("")}
          ${matrix
            .map(({ isoDate, dayNumber, isCurrentMonth }) => {
              const isSelected = isSameDate(isoDate, selectedDate);
              const isToday = isSameDate(isoDate, todayISO());
              return `
                <button
                  type="button"
                  class="event-date-picker__day ${!isCurrentMonth ? "is-outside" : ""} ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}"
                  data-picker-date="${isoDate}"
                >
                  ${dayNumber}
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function getTimePickerMarkup(selectedTime) {
    const normalizedTime = selectedTime ? String(selectedTime).slice(0, 5) : "";
    const [selectedHour = "", selectedMinute = ""] = normalizedTime.split(":");

    return `
      <div class="event-time-picker" id="event-time-picker" hidden>
        <button
          type="button"
          class="event-time-picker__clear ${!normalizedTime ? "is-selected" : ""}"
          data-picker-time=""
        >
          Sem horario
        </button>
        <div class="event-time-picker__columns">
          <div class="event-time-picker__column">
            <span class="event-time-picker__column-title">Hora</span>
            <div class="event-time-picker__options">
              ${getHourOptions()
                .map(
                  (hour) => `
                    <button
                      type="button"
                      class="event-time-picker__option ${selectedHour === hour ? "is-selected" : ""}"
                      data-picker-hour="${hour}"
                    >
                      ${hour}
                    </button>
                  `
                )
                .join("")}
            </div>
          </div>
          <div class="event-time-picker__column">
            <span class="event-time-picker__column-title">Min</span>
            <div class="event-time-picker__options">
              ${getMinuteOptions()
                .map(
                  (minute) => `
                    <button
                      type="button"
                      class="event-time-picker__option ${selectedMinute === minute ? "is-selected" : ""}"
                      data-picker-minute="${minute}"
                    >
                      ${minute}
                    </button>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindEventDateTimePickers() {
    eventDateTimePickerCleanup?.();

    const dateField = document.querySelector("#event-date-picker-trigger");
    const timeField = document.querySelector("#event-time-picker-trigger");
    const datePicker = document.querySelector("#event-date-picker");
    const timePicker = document.querySelector("#event-time-picker");
    const dateValue = document.querySelector("#event-date-picker-value");
    const timeValue = document.querySelector("#event-time-picker-value");
    const dateInput = document.querySelector('#event-form input[name="eventDate"]');
    const timeInput = document.querySelector('#event-form input[name="eventTime"]');
    const monthLabel = document.querySelector(".event-date-picker__month");
    const dateGrid = document.querySelector(".event-date-picker__grid");

    if (!dateField || !timeField || !datePicker || !timePicker || !dateValue || !timeValue || !dateInput || !timeInput || !monthLabel || !dateGrid) {
      eventDateTimePickerCleanup = null;
      return;
    }

    let pickerMonth = new Date(`${dateInput.value || state.selectedDate}T12:00:00`);

    const setExpanded = (element, expanded) => {
      element.setAttribute("aria-expanded", String(expanded));
    };

    const closePickers = () => {
      datePicker.hidden = true;
      timePicker.hidden = true;
      setExpanded(dateField, false);
      setExpanded(timeField, false);
    };

    const syncTimePicker = () => {
      const [selectedHour = "", selectedMinute = ""] = String(timeInput.value || "").split(":");

      timePicker.querySelectorAll("[data-picker-time]").forEach((buttonElement) => {
        buttonElement.classList.toggle("is-selected", buttonElement.dataset.pickerTime === (timeInput.value || ""));
      });

      timePicker.querySelectorAll("[data-picker-hour]").forEach((buttonElement) => {
        buttonElement.classList.toggle("is-selected", buttonElement.dataset.pickerHour === selectedHour);
      });

      timePicker.querySelectorAll("[data-picker-minute]").forEach((buttonElement) => {
        buttonElement.classList.toggle("is-selected", buttonElement.dataset.pickerMinute === selectedMinute);
      });
    };

    const setTimeValue = ({ hour, minute } = {}) => {
      const [currentHour = "", currentMinute = ""] = String(timeInput.value || "").split(":");
      const nextHour = (hour ?? currentHour) || getHourOptions()[0];
      const nextMinute = (minute ?? currentMinute) || getMinuteOptions()[0];

      timeInput.value = `${nextHour}:${nextMinute}`;
      timeValue.textContent = getEventTimeLabel(timeInput.value);
      syncTimePicker();
    };

    const syncDatePicker = () => {
      monthLabel.textContent = formatMonthYear(pickerMonth);
      const matrix = getMonthMatrix(pickerMonth);

      dateGrid.innerHTML = `
        ${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((weekday) => `<div class="event-date-picker__weekday">${weekday}</div>`).join("")}
        ${matrix
          .map(({ isoDate, dayNumber, isCurrentMonth }) => {
            const isSelected = isSameDate(isoDate, dateInput.value);
            const isToday = isSameDate(isoDate, todayISO());
            return `
              <button
                type="button"
                class="event-date-picker__day ${!isCurrentMonth ? "is-outside" : ""} ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}"
                data-picker-date="${isoDate}"
              >
                ${dayNumber}
              </button>
            `;
          })
          .join("")}
      `;

      dateGrid.querySelectorAll("[data-picker-date]").forEach((buttonElement) => {
        buttonElement.addEventListener("click", () => {
          dateInput.value = buttonElement.dataset.pickerDate;
          dateValue.textContent = getEventDateLabel(buttonElement.dataset.pickerDate);
          syncDatePicker();
          closePickers();
        });
      });
    };

    const handleDocumentClick = (event) => {
      const target = event.target;
      if (!dateField.contains(target) && !timeField.contains(target) && !datePicker.contains(target) && !timePicker.contains(target)) {
        closePickers();
      }
    };

    dateField.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = datePicker.hidden;
      closePickers();
      datePicker.hidden = !willOpen;
      setExpanded(dateField, willOpen);
    });

    timeField.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = timePicker.hidden;
      closePickers();
      timePicker.hidden = !willOpen;
      setExpanded(timeField, willOpen);
    });

    document.querySelector("#event-date-picker-prev")?.addEventListener("click", () => {
      pickerMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1);
      syncDatePicker();
    });

    document.querySelector("#event-date-picker-next")?.addEventListener("click", () => {
      pickerMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1);
      syncDatePicker();
    });

    timePicker.querySelectorAll("[data-picker-time]").forEach((buttonElement) => {
      buttonElement.addEventListener("click", () => {
        timeInput.value = buttonElement.dataset.pickerTime || "";
        timeValue.textContent = getEventTimeLabel(timeInput.value);
        syncTimePicker();
        closePickers();
      });
    });

    timePicker.querySelectorAll("[data-picker-hour]").forEach((buttonElement) => {
      buttonElement.addEventListener("click", () => {
        setTimeValue({ hour: buttonElement.dataset.pickerHour || "" });
      });
    });

    timePicker.querySelectorAll("[data-picker-minute]").forEach((buttonElement) => {
      buttonElement.addEventListener("click", () => {
        setTimeValue({ minute: buttonElement.dataset.pickerMinute || "" });
      });
    });

    syncDatePicker();
    syncTimePicker();

    document.addEventListener("click", handleDocumentClick);
    eventDateTimePickerCleanup = () => {
      document.removeEventListener("click", handleDocumentClick);
      eventDateTimePickerCleanup = null;
    };
  }

  function openEventModal(eventItem = null) {
    if (context.isReadOnly()) {
      return;
    }

    const selectedIcon = eventItem?.icon ?? "🗓️";

    context.modal.open({
      title: eventItem ? "Editar evento" : "Novo evento",
      description: "",
      content: `
        <form class="form-stack" id="event-form">
          <div class="event-datetime-row">
            <label>
              Data
              <div class="picker-field picker-field--custom">
                <button type="button" class="picker-field__trigger" id="event-date-picker-trigger" aria-expanded="false">
                  <span id="event-date-picker-value">${getEventDateLabel(eventItem?.event_date ?? state.selectedDate)}</span>
                </button>
                <input type="hidden" name="eventDate" value="${eventItem?.event_date ?? state.selectedDate}" required />
                ${getDatePickerMarkup(eventItem?.event_date ?? state.selectedDate)}
              </div>
            </label>
            <label>
              Horário
              <div class="picker-field picker-field--custom">
                <button type="button" class="picker-field__trigger" id="event-time-picker-trigger" aria-expanded="false">
                  <span id="event-time-picker-value">${getEventTimeLabel(String(eventItem?.event_time ?? "").slice(0, 5))}</span>
                </button>
                <input type="hidden" name="eventTime" value="${String(eventItem?.event_time ?? "").slice(0, 5)}" />
                ${getTimePickerMarkup(String(eventItem?.event_time ?? "").slice(0, 5))}
              </div>
            </label>
          </div>
          <div class="event-title-group">
            <label>
              Título
              <div class="event-title-field">
                <input name="title" maxlength="80" value="${eventItem?.title ?? ""}" placeholder="Ex.: Reunião com cliente" required />
                <button
                  type="button"
                  class="event-icon-trigger"
                  id="event-icon-trigger"
                  aria-label="Escolher ícone"
                  aria-expanded="false"
                >
                  <span id="selected-event-icon">${selectedIcon}</span>
                </button>
                <input type="hidden" name="icon" value="${selectedIcon}" />
              </div>
            </label>
            <div class="event-icon-picker" id="event-icon-picker" hidden>
              ${EVENT_EMOJI_OPTIONS.map(
                (emoji) => `
                  <button
                    type="button"
                    class="event-icon-option ${selectedIcon === emoji ? "is-selected" : ""}"
                    data-icon="${emoji}"
                    aria-label="Selecionar ícone ${emoji}"
                  >
                    ${emoji}
                  </button>
                `
              ).join("")}
            </div>
          </div>
          <label>
            Lembrete
            <span class="picker-field picker-field--select">
              <select name="reminderMinutes">
                ${REMINDER_OPTIONS.map((option) => `<option value="${option.value}" ${String(eventItem?.reminder_minutes ?? "") === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
              </select>
            </span>
          </label>
        </form>
      `,
      footer: `
        ${button("Cancelar", "ghost", 'type="button" data-close-modal')}
        ${button(eventItem ? "Salvar alterações" : "Salvar evento", "primary", 'type="submit" form="event-form"')}
      `
    });

    bindIconPicker();
    bindEventDateTimePickers();

    document.querySelector("#event-form").addEventListener("submit", async (submitEvent) => {
      submitEvent.preventDefault();
      const formData = new FormData(submitEvent.currentTarget);
      const payload = {
        title: String(formData.get("title")).trim(),
        icon: String(formData.get("icon")).trim() || "🗓️",
        description: null,
        eventDate: String(formData.get("eventDate")).trim(),
        eventTime: String(formData.get("eventTime")).trim(),
        reminderMinutes: String(formData.get("reminderMinutes")).trim()
      };

      const validation = validateRequired(payload.title, "Informe o nome do evento.");
      if (validation) {
        context.toast.error(validation);
        return;
      }

      try {
        if (eventItem) {
          await eventsService.updateEvent(eventItem.id, payload);
          context.toast.success("Evento atualizado.");
        } else {
          await eventsService.createEvent(payload);
          context.toast.success("Evento criado.");
        }

        clearMonthCaches();
        clearSelection();
        state.selectedDate = payload.eventDate;
        context.modal.close();
        await refreshCalendarData(context.root, { preferCache: false, reloadPending: true });
      } catch (error) {
        context.toast.error(error.message || "Não foi possível salvar o evento.");
      }
    });
  }

  async function removeEvents(ids, root) {
    await Promise.all(ids.map((id) => eventsService.deleteEvent(id)));
    clearMonthCaches();
    clearSelection();
    context.modal.close();
    context.toast.success(ids.length > 1 ? "Eventos excluídos." : "Evento excluído.");
    await refreshCalendarData(root, { preferCache: false, reloadPending: true });
  }

  function openDeleteEventsModal(ids, root) {
    if (context.isReadOnly()) {
      return;
    }

    const selectedEvents = getAllKnownEvents().filter((event) => ids.includes(String(event.id)));
    const firstTitle = selectedEvents[0]?.title ?? "este evento";

    context.modal.open({
      title: ids.length > 1 ? "Excluir eventos" : "Excluir evento",
      description:
        ids.length > 1
          ? `Deseja remover ${ids.length} eventos do calendário?`
          : `Deseja remover "${firstTitle}" do calendário?`,
      content: "<p>Os eventos selecionados serão apagados definitivamente.</p>",
      footer: `
        ${button("Cancelar", "ghost", 'type="button" data-close-modal')}
        ${button("Excluir", "danger", 'type="button" id="confirm-delete-events"')}
      `
    });

    document.querySelector("#confirm-delete-events").addEventListener("click", async () => {
      try {
        await removeEvents(ids, root);
      } catch (error) {
        context.toast.error(error.message || "Não foi possível excluir os eventos.");
      }
    });
  }

  return {
    render,
    openCreateEventModal() {
      openEventModal();
    }
  };
}
