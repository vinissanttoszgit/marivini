import eventsService from "../services/eventsService.js";
import { button } from "../components/button.js";
import { calendarGrid } from "../components/calendarGrid.js";
import { emptyState } from "../components/emptyState.js";
import { eventCard } from "../components/eventCard.js";
import { loadingState } from "../components/loadingState.js";
import {
  formatLongDate,
  formatMonthYear,
  getCalendarMonthBounds,
  shiftMonth,
  todayISO
} from "../utils/dates.js";
import { validateRequired } from "../utils/validators.js";

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
    monthlyEvents: []
  };

  async function loadMonth() {
    const { startDate, endDate } = getCalendarMonthBounds(state.currentMonth);
    state.monthlyEvents = await eventsService.listEventsByMonth({ startDate, endDate });
  }

  async function render(root) {
    context.setHeader({
      eyebrow: "Marivini",
      title: "Calendário",
      subtitle: "Eventos e lembretes"
    });

    root.innerHTML = loadingState("Sincronizando seu calendário...");

    try {
      await loadMonth();
      root.innerHTML = getMarkup();
      bind(root);
    } catch (error) {
      context.toast.error(error.message || "Não foi possível carregar o calendário.");
      root.innerHTML = emptyState({
        icon: "🗓️",
        title: "Calendário indisponível",
        description: "Confira as credenciais do Supabase e tente novamente."
      });
    }
  }

  function getMarkup() {
    const eventsByDate = state.monthlyEvents.reduce((accumulator, event) => {
      accumulator[event.event_date] = accumulator[event.event_date] || [];
      accumulator[event.event_date].push(event);
      return accumulator;
    }, {});

    const selectedEvents = eventsByDate[state.selectedDate] ?? [];

    return `
      <div class="page-stack">
        <section class="card calendar-card">
          <div class="calendar-header">
            <button class="icon-button" id="prev-month" aria-label="Mês anterior">‹</button>
            <div class="calendar-header__label">${formatMonthYear(state.currentMonth)}</div>
            <button class="icon-button" id="next-month" aria-label="Próximo mês">›</button>
          </div>
          ${calendarGrid({ currentDate: state.currentMonth, selectedDate: state.selectedDate, eventsByDate })}
        </section>

        <div class="section-row">
          <div>
            <h2 class="section-title">${formatLongDate(state.selectedDate)}</h2>
            <p>${selectedEvents.length ? "Eventos programados para este dia." : "Sem compromissos agendados."}</p>
          </div>
        </div>

        ${
          selectedEvents.length
            ? `<section class="events-list">${selectedEvents.map((event) => eventCard(event)).join("")}</section>`
            : emptyState({
                icon: "➕",
                title: "Nada por aqui",
                description: "Crie um evento para organizar seu dia.",
                action: button("Adicionar evento", "primary", 'id="empty-create-event"')
              })
        }
      </div>
      <button class="floating-action" id="floating-add-event" aria-label="Adicionar evento">+</button>
    `;
  }

  function bind(root) {
    root.querySelector("#prev-month").addEventListener("click", async () => {
      state.currentMonth = shiftMonth(state.currentMonth, -1);
      await render(root);
    });

    root.querySelector("#next-month").addEventListener("click", async () => {
      state.currentMonth = shiftMonth(state.currentMonth, 1);
      await render(root);
    });

    root.querySelectorAll("[data-date]").forEach((buttonElement) => {
      buttonElement.addEventListener("click", async () => {
        state.selectedDate = buttonElement.dataset.date;
        root.innerHTML = getMarkup();
        bind(root);
      });
    });

    root.querySelector("#floating-add-event")?.addEventListener("click", () => openEventModal());
    root.querySelector("#empty-create-event")?.addEventListener("click", () => openEventModal());

    root.querySelectorAll("[data-action='edit-event']").forEach((element) => {
      element.addEventListener("click", () => {
        const eventItem = state.monthlyEvents.find((item) => item.id === element.dataset.id);
        openEventModal(eventItem);
      });
    });

    root.querySelectorAll("[data-action='delete-event']").forEach((element) => {
      element.addEventListener("click", async () => {
        const eventItem = state.monthlyEvents.find((item) => item.id === element.dataset.id);
        openDeleteEventModal(eventItem, root);
      });
    });
  }

  function openEventModal(eventItem = null) {
    context.modal.open({
      title: eventItem ? "Editar evento" : "Novo evento",
      description: "Crie lembretes simples e mantenha seu dia organizado.",
      content: `
        <form class="form-stack" id="event-form">
          <label>
            Título
            <input name="title" maxlength="80" value="${eventItem?.title ?? ""}" placeholder="Ex.: Reunião com cliente" required />
          </label>
          <label>
            Descrição
            <textarea name="description" maxlength="220" placeholder="Opcional">${eventItem?.description ?? ""}</textarea>
          </label>
          <label>
            Data
            <input type="date" name="eventDate" value="${eventItem?.event_date ?? state.selectedDate}" required />
          </label>
          <label>
            Horário
            <input type="time" name="eventTime" value="${eventItem?.event_time ?? ""}" />
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
        description: String(formData.get("description")).trim(),
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
        state.selectedDate = payload.eventDate;
        context.modal.close();
        await render(context.root);
      } catch (error) {
        context.toast.error(error.message || "Não foi possível salvar o evento.");
      }
    });
  }

  function openDeleteEventModal(eventItem, root) {
    context.modal.open({
      title: "Excluir evento",
      description: `Deseja remover "${eventItem.title}" do calendário?`,
      content: "<p>Esse evento será apagado definitivamente.</p>",
      footer: `
        ${button("Cancelar", "ghost", 'type="button" data-close-modal')}
        ${button("Excluir", "danger", 'type="button" id="confirm-delete-event"')}
      `
    });

    document.querySelector("#confirm-delete-event").addEventListener("click", async () => {
      try {
        await eventsService.deleteEvent(eventItem.id);
        context.modal.close();
        context.toast.success("Evento excluído.");
        await render(root);
      } catch (error) {
        context.toast.error(error.message || "Não foi possível excluir o evento.");
      }
    });
  }

  return { render };
}
