import eventsService from "../services/eventsService.js";
import { button } from "../components/button.js";
import { calendarGrid } from "../components/calendarGrid.js";
import { emptyState } from "../components/emptyState.js";
import { eventCard } from "../components/eventCard.js";
import { loadingState } from "../components/loadingState.js";
import {
  formatMonthYear,
  getCalendarMonthBounds,
  shiftMonth,
  todayISO
} from "../utils/dates.js";
import { validateRequired } from "../utils/validators.js";

const LONG_PRESS_MS = 500;
const POINTER_CANCEL_DISTANCE = 10;

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
    monthlyEvents: [],
    selectedEventIds: [],
    selectionMode: false
  };

  const monthCache = new Map();
  let consumedLongPressEventId = null;
  let consumedLongPressUntil = 0;

  function getMonthCacheKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
    return sortEvents(state.monthlyEvents.filter((event) => event.event_date > state.selectedDate));
  }

  async function fetchMonthEvents(date) {
    const { startDate, endDate } = getCalendarMonthBounds(date);
    return sortEvents(await eventsService.listEventsByMonth({ startDate, endDate }));
  }

  async function loadMonth({ preferCache = true } = {}) {
    const monthKey = getMonthCacheKey(state.currentMonth);

    if (preferCache && monthCache.has(monthKey)) {
      state.monthlyEvents = [...monthCache.get(monthKey)];
      return;
    }

    const events = await fetchMonthEvents(state.currentMonth);
    monthCache.set(monthKey, events);
    state.monthlyEvents = [...events];
  }

  function preloadAdjacentMonths() {
    [shiftMonth(state.currentMonth, -1), shiftMonth(state.currentMonth, 1)].forEach(async (monthDate) => {
      const monthKey = getMonthCacheKey(monthDate);
      if (monthCache.has(monthKey)) {
        return;
      }

      try {
        const events = await fetchMonthEvents(monthDate);
        monthCache.set(monthKey, events);
      } catch {
        // Ignora falhas de preload para nao interferir na navegacao principal.
      }
    });
  }

  async function refreshMonthView(root, { preferCache = true } = {}) {
    await loadMonth({ preferCache });
    refreshContent(root);
    preloadAdjacentMonths();
  }

  async function changeMonth(root, amount) {
    const previousMonth = state.currentMonth;
    const previousSelectedDate = state.selectedDate;

    clearSelection();
    state.currentMonth = shiftMonth(state.currentMonth, amount);
    syncSelectedDateWithCurrentMonth();

    try {
      await refreshMonthView(root, { preferCache: true });
    } catch (error) {
      state.currentMonth = previousMonth;
      state.selectedDate = previousSelectedDate;
      context.toast.error(error.message || "Não foi possível carregar este mês.");
    }
  }

  async function render(root) {
    context.setHeader({
      eyebrow: "",
      title: "Calendário",
      subtitle: ""
    });

    root.innerHTML = loadingState();

    try {
      await refreshMonthView(root, { preferCache: true });
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
    if (!state.selectionMode) {
      return "";
    }

    return `
      <section class="event-selection-floating-bar" aria-label="Ações dos eventos selecionados">
        ${button("Cancelar", "ghost", 'type="button" id="cancel-event-selection"')}
        ${button(`Excluir ${state.selectedEventIds.length}`, "danger", `type="button" id="delete-selected-events" ${state.selectedEventIds.length ? "" : "disabled"}`)}
      </section>
    `;
  }

  function getMarkup() {
    const eventsByDate = getEventsByDate();
    const selectedEvents = getSelectedDateEvents();
    const upcomingEvents = getUpcomingEvents();
    const selectionSet = getSelectionSet();

    return `
      <div class="page-stack ${state.selectionMode ? "page-stack--selection-mode" : ""}">
        <section class="card calendar-card">
          <div class="calendar-header">
            <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--prev" id="prev-month" aria-label="Mês anterior"></button>
            <div class="calendar-header__label">${formatMonthYear(state.currentMonth)}</div>
            <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--next" id="next-month" aria-label="Próximo mês"></button>
          </div>
          ${calendarGrid({ currentDate: state.currentMonth, selectedDate: state.selectedDate, eventsByDate })}
        </section>

        ${
          selectedEvents.length
            ? `<section class="events-list">${selectedEvents
                .map((event) =>
                  eventCard(event, {
                    isSelectionMode: state.selectionMode,
                    isSelected: selectionSet.has(String(event.id))
                  })
                )
                .join("")}</section>`
            : ""
        }

        ${
          upcomingEvents.length
            ? `
              <section class="events-upcoming">
                <div class="events-section-divider">
                  <span>Próximos eventos</span>
                </div>
                <div class="events-list">
                  ${upcomingEvents
                    .map((event) =>
                      eventCard(event, {
                        isSelectionMode: state.selectionMode,
                        isSelected: selectionSet.has(String(event.id)),
                        showDate: true
                      })
                    )
                    .join("")}
                </div>
              </section>
            `
            : ""
        }
      </div>
      ${getSelectionBarMarkup()}
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
    root.querySelector("#prev-month").addEventListener("click", async () => {
      await changeMonth(root, -1);
    });

    root.querySelector("#next-month").addEventListener("click", async () => {
      await changeMonth(root, 1);
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
        event.stopPropagation();
        const eventItem = state.monthlyEvents.find((item) => String(item.id) === String(element.dataset.id));
        if (eventItem) {
          openEventModal(eventItem);
        }
      });
    });

    bindSelectionBar(root);
    root.querySelectorAll("[data-event-id]").forEach((element) => bindEventCard(root, element));
  }

  function bindEventCard(root, element) {
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

  function openEventModal(eventItem = null) {
    context.modal.open({
      title: eventItem ? "Editar evento" : "Novo evento",
      description: "",
      content: `
        <form class="form-stack" id="event-form">
          <label>
            Data
            <input type="date" name="eventDate" value="${eventItem?.event_date ?? state.selectedDate}" required />
          </label>
          <label>
            Horário
            <input type="time" name="eventTime" value="${eventItem?.event_time ?? ""}" />
          </label>
          <label>
            Título
            <input name="title" maxlength="80" value="${eventItem?.title ?? ""}" placeholder="Ex.: Reunião com cliente" required />
          </label>
          <label>
            Lembrete
            <select name="reminderMinutes">
              ${REMINDER_OPTIONS.map((option) => `<option value="${option.value}" ${String(eventItem?.reminder_minutes ?? "") === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
            </select>
          </label>
        </form>
      `,
      footer: `
        ${button("Cancelar", "ghost", 'type="button" data-close-modal')}
        ${button(eventItem ? "Salvar alterações" : "Salvar evento", "primary", 'type="submit" form="event-form"')}
      `
    });

    document.querySelector("#event-form").addEventListener("submit", async (submitEvent) => {
      submitEvent.preventDefault();
      const formData = new FormData(submitEvent.currentTarget);
      const payload = {
        title: String(formData.get("title")).trim(),
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

        monthCache.clear();
        clearSelection();
        state.selectedDate = payload.eventDate;
        context.modal.close();
        await refreshMonthView(context.root, { preferCache: false });
      } catch (error) {
        context.toast.error(error.message || "Não foi possível salvar o evento.");
      }
    });
  }

  async function removeEvents(ids, root) {
    await Promise.all(ids.map((id) => eventsService.deleteEvent(id)));
    monthCache.clear();
    clearSelection();
    context.modal.close();
    context.toast.success(ids.length > 1 ? "Eventos excluídos." : "Evento excluído.");
    await refreshMonthView(root, { preferCache: false });
  }

  function openDeleteEventsModal(ids, root) {
    const selectedEvents = state.monthlyEvents.filter((event) => ids.includes(String(event.id)));
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
