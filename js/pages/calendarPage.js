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
const PENDING_EVENTS_LIMIT = 20;

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
    monthlyEvents: [],
    pendingEvents: [],
    selectedEventIds: [],
    selectionMode: false
  };

  const monthCache = new Map();
  let iconPickerCleanup = null;
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

  async function loadPendingEvents() {
    state.pendingEvents = sortEvents(
      await eventsService.listPendingEvents({
        startDate: todayISO(),
        limit: PENDING_EVENTS_LIMIT
      })
    );
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

  async function refreshCalendarData(root, { preferCache = true, reloadPending = true } = {}) {
    await loadMonth({ preferCache });

    if (reloadPending) {
      await loadPendingEvents();
    }

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
      await refreshCalendarData(root, { preferCache: true, reloadPending: true });
    } catch (error) {
      state.currentMonth = previousMonth;
      state.selectedDate = previousSelectedDate;
      context.toast.error(error.message || "Não foi possível carregar este mês.");
    }
  }

  async function render(root) {
    const calendarCacheKey = getCalendarVisibilityCacheKey();
    if (renderedCalendarCacheKey !== calendarCacheKey) {
      monthCache.clear();
      clearSelection();
      renderedCalendarCacheKey = calendarCacheKey;
    }

    context.setHeader({
      eyebrow: "",
      title: "Calendário",
      subtitle: ""
    });

    root.innerHTML = loadingState();

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

    return `
      <section class="event-selection-floating-bar" aria-label="Ações dos eventos selecionados">
        ${button("Cancelar", "ghost", 'type="button" id="cancel-event-selection"')}
        ${button(`Excluir ${state.selectedEventIds.length}`, "danger", `type="button" id="delete-selected-events" ${state.selectedEventIds.length ? "" : "disabled"}`)}
      </section>
    `;
  }

  function getMarkup() {
    const canEdit = !context.isReadOnly();
    const eventsByDate = getEventsByDate();
    const selectedEvents = getSelectedDateEvents();
    const upcomingEvents = getUpcomingEvents();
    const selectionSet = getSelectionSet();

    return `
      <div class="page-stack ${state.selectionMode && canEdit ? "page-stack--selection-mode" : ""}">
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
                    isSelectionMode: state.selectionMode && canEdit,
                    isSelected: canEdit && selectionSet.has(String(event.id)),
                    canEdit
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
              <span class="picker-field picker-field--date">
                <input type="date" name="eventDate" value="${eventItem?.event_date ?? state.selectedDate}" required />
              </span>
            </label>
            <label>
              Horário
              <span class="picker-field picker-field--time">
                <input type="time" name="eventTime" value="${eventItem?.event_time ?? ""}" />
              </span>
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

        monthCache.clear();
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
    monthCache.clear();
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
