import habitsService from "../services/habitsService.js";
import habitLogsService from "../services/habitLogsService.js";
import { button } from "../components/button.js";
import { emptyState } from "../components/emptyState.js";
import { habitCard } from "../components/habitCard.js";
import { progressCard } from "../components/progressCard.js";
import { loadingState } from "../components/loadingState.js";
import {
  addDays,
  endOfDayISO,
  formatHabitDateLabel,
  getWeekdayIndex,
  parseISODate,
  startOfDayISO,
  todayISO
} from "../utils/dates.js";
import { calculateHabitStatus } from "../utils/streak.js";
import { validateRequired } from "../utils/validators.js";

const EMOJI_OPTIONS = ["✨", "📚", "💧", "🏃", "🧘", "🍎", "💻", "🌙"];
const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5, 6, 0];
const LONG_PRESS_MS = 500;
const WEEKDAY_OPTIONS = [
  { value: 1, label: "SEG" },
  { value: 2, label: "TER" },
  { value: 3, label: "QUA" },
  { value: 4, label: "QUI" },
  { value: 5, label: "SEX" },
  { value: 6, label: "SÁB" },
  { value: 0, label: "DOM" }
];

export function createHabitsPage(context) {
  const state = {
    habits: [],
    selectedLogs: [],
    recentLogs: [],
    selectedDate: todayISO(),
    selectionMode: false,
    selectedHabitIds: []
  };

  function normalizeActiveDays(activeDays) {
    if (!Array.isArray(activeDays) || !activeDays.length) {
      return [...DEFAULT_ACTIVE_DAYS];
    }

    const uniqueDays = [...new Set(activeDays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
    return uniqueDays.length ? uniqueDays : [...DEFAULT_ACTIVE_DAYS];
  }

  function getSelectionSet() {
    return new Set(state.selectedHabitIds);
  }

  function getSelectedDateObject() {
    return parseISODate(state.selectedDate);
  }

  async function loadHabits() {
    state.habits = (await habitsService.listHabits()).map((habit) => ({
      ...habit,
      active_days: normalizeActiveDays(habit.active_days)
    }));
  }

  async function loadSelectedDateData() {
    const selectedDateObject = getSelectedDateObject();
    state.selectedLogs = await habitLogsService.listLogsByDate(state.selectedDate);
    state.recentLogs = await habitLogsService.listLogsRange({
      startDate: startOfDayISO(addDays(selectedDateObject, -14)),
      endDate: endOfDayISO(selectedDateObject)
    });
  }

  async function load() {
    await Promise.all([loadHabits(), loadSelectedDateData()]);
  }

  async function render(root) {
    context.setHeader({
      eyebrow: "",
      title: "Hábitos",
      subtitle: ""
    });

    root.innerHTML = loadingState();

    try {
      await load();
      refreshContent(root);
    } catch (error) {
      context.toast.error(error.message || "Não foi possível carregar os hábitos.");
      root.innerHTML = emptyState({
        icon: "⚠️",
        title: "Falha ao carregar",
        description: "Confira a configuração do Supabase e tente novamente."
      });
    }
  }

  function getCompletedIds() {
    return new Set(state.selectedLogs.filter((log) => log.completed).map((log) => log.habit_id));
  }

  function getVisibleHabits() {
    const weekday = getWeekdayIndex(state.selectedDate);
    return state.habits.filter((habit) => normalizeActiveDays(habit.active_days).includes(weekday));
  }

  function getDateLabel() {
    return formatHabitDateLabel(state.selectedDate);
  }

  function getMarkup() {
    const visibleHabits = getVisibleHabits();
    const completedIds = getCompletedIds();
    const completed = visibleHabits.filter((habit) => completedIds.has(habit.id)).length;
    const selectionSet = getSelectionSet();

    return `
      <div class="page-stack">
        <section class="card habit-date-nav" aria-label="Selecionar data">
          <button class="icon-button" id="prev-habit-date" aria-label="Dia anterior">‹</button>
          <div class="habit-date-nav__label">${getDateLabel()}</div>
          <button class="icon-button" id="next-habit-date" aria-label="Próximo dia">›</button>
        </section>
        ${progressCard({ completed, total: visibleHabits.length })}
        ${
          state.selectionMode
            ? `<section class="card habit-selection-bar">
                ${button("Cancelar", "ghost", 'type="button" id="cancel-habit-selection"')}
                ${button(`Excluir ${selectionSet.size}`, "danger", `type="button" id="delete-selected-habits" ${selectionSet.size ? "" : "disabled"}`)}
              </section>`
            : ""
        }
        ${button("Adicionar hábito", "secondary", 'id="open-habit-modal" class="section-action section-action--full"')}
        ${
          visibleHabits.length
            ? `<section class="habit-list">${visibleHabits
                .map((habit) =>
                  habitCard({
                    habit,
                    isCompleted: completedIds.has(habit.id),
                    streakData: calculateHabitStatus(
                      state.recentLogs.filter((log) => log.habit_id === habit.id),
                      state.selectedDate
                    ),
                    isSelectionMode: state.selectionMode,
                    isSelected: selectionSet.has(habit.id)
                  })
                )
                .join("")}</section>`
            : emptyState({
                icon: "🌿",
                title: state.habits.length ? "Nada para este dia" : "Nenhum hábito criado",
                description: state.habits.length
                  ? "Escolha outro dia ou adicione um hábito para esta rotina."
                  : "Adicione seu primeiro hábito para começar a acompanhar sua rotina.",
                action: button(state.habits.length ? "Adicionar hábito" : "Criar primeiro hábito", "primary", 'id="empty-create-habit"')
              })
        }
      </div>
    `;
  }

  function refreshContent(root = context.root) {
    root.innerHTML = getMarkup();
    bind(root);
  }

  function clearSelection() {
    state.selectionMode = false;
    state.selectedHabitIds = [];
  }

  function toggleSelection(habitId) {
    const selectionSet = getSelectionSet();
    if (selectionSet.has(habitId)) {
      selectionSet.delete(habitId);
    } else {
      selectionSet.add(habitId);
    }

    state.selectedHabitIds = [...selectionSet];
    if (!state.selectedHabitIds.length) {
      clearSelection();
    }
  }

  function enterSelectionMode(habitId) {
    state.selectionMode = true;
    state.selectedHabitIds = [habitId];
  }

  function updateLogCollections(habitId, completed) {
    const matchesHabitAndDate = (log) => log.habit_id === habitId && log.log_date === state.selectedDate;
    state.selectedLogs = completed
      ? [...state.selectedLogs.filter((log) => !matchesHabitAndDate(log)), { habit_id: habitId, log_date: state.selectedDate, completed: true }]
      : state.selectedLogs.filter((log) => !matchesHabitAndDate(log));

    state.recentLogs = completed
      ? [...state.recentLogs.filter((log) => !matchesHabitAndDate(log)), { habit_id: habitId, log_date: state.selectedDate, completed: true }]
      : state.recentLogs.filter((log) => !matchesHabitAndDate(log));
  }

  async function handleToggleHabit(habitId) {
    const completedIds = getCompletedIds();
    const willComplete = !completedIds.has(habitId);

    updateLogCollections(habitId, willComplete);
    refreshContent();

    try {
      if (willComplete) {
        await habitLogsService.markHabitComplete({ habitId, date: state.selectedDate });
      } else {
        await habitLogsService.unmarkHabitComplete({ habitId, date: state.selectedDate });
      }
    } catch (error) {
      updateLogCollections(habitId, !willComplete);
      refreshContent();
      context.toast.error(error.message || "Não foi possível atualizar o hábito.");
    }
  }

  async function changeSelectedDate(amount) {
    state.selectedDate = startOfDayISO(addDays(getSelectedDateObject(), amount));
    clearSelection();

    try {
      await loadSelectedDateData();
      refreshContent();
    } catch (error) {
      state.selectedDate = startOfDayISO(addDays(getSelectedDateObject(), -amount));
      context.toast.error(error.message || "Não foi possível carregar os hábitos deste dia.");
    }
  }

  async function persistHabit({ habit, payload }) {
    const savedHabit = habit ? await habitsService.updateHabit(habit.id, payload) : await habitsService.createHabit(payload);
    state.habits = habit
      ? state.habits.map((item) => (item.id === habit.id ? { ...savedHabit, active_days: normalizeActiveDays(savedHabit.active_days) } : item))
      : [...state.habits, { ...savedHabit, active_days: normalizeActiveDays(savedHabit.active_days) }];

    clearSelection();
    context.modal.close();
    refreshContent();
    context.toast.success(habit ? "Hábito atualizado." : "Hábito criado.");
  }

  function getModalWeekdayMarkup(activeDays) {
    const selectedDays = normalizeActiveDays(activeDays);
    return `
      <div class="weekday-picker" id="weekday-picker">
        ${WEEKDAY_OPTIONS.map(
          (option) => `
            <button
              type="button"
              class="weekday-chip ${selectedDays.includes(option.value) ? "is-selected" : ""}"
              data-day="${option.value}"
              aria-pressed="${selectedDays.includes(option.value)}"
            >
              ${option.label}
            </button>
          `
        ).join("")}
      </div>
    `;
  }

  function bindWeekdayPicker() {
    document.querySelectorAll(".weekday-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        chip.classList.toggle("is-selected");
        chip.setAttribute("aria-pressed", String(chip.classList.contains("is-selected")));
      });
    });
  }

  function readSelectedWeekdays() {
    return WEEKDAY_OPTIONS.filter((option) =>
      document.querySelector(`.weekday-chip[data-day="${option.value}"]`)?.classList.contains("is-selected")
    ).map((option) => option.value);
  }

  function openHabitModal(habit = null) {
    context.modal.open({
      title: habit ? "Editar hábito" : "Novo hábito",
      description: "",
      content: `
        <form class="form-stack" id="habit-form">
          <div class="weekday-field">
            <span class="weekday-field__label">Frequência</span>
            ${getModalWeekdayMarkup(habit?.active_days)}
          </div>
          <label>
            Título
            <input name="title" maxlength="80" value="${habit?.title ?? ""}" placeholder="Ex.: Ler 20 minutos" required />
          </label>
          <div class="habit-icon-field">
            <span class="habit-icon-field__label">Ícone</span>
            <select class="habit-icon-field__select" name="icon" aria-label="Selecionar ícone do hábito">
              ${EMOJI_OPTIONS.map((emoji) => `<option value="${emoji}" ${habit?.icon === emoji ? "selected" : ""}>${emoji}</option>`).join("")}
            </select>
          </div>
        </form>
      `,
      footer: `
        ${button("Cancelar", "ghost", 'type="button" data-close-modal')}
        ${button(habit ? "Salvar alterações" : "Salvar hábito", "primary", 'type="submit" form="habit-form"')}
      `
    });

    bindWeekdayPicker();

    document.querySelector("#habit-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const activeDays = readSelectedWeekdays();
      const payload = {
        title: String(formData.get("title")).trim(),
        description: null,
        icon: String(formData.get("icon")).trim(),
        active_days: activeDays
      };

      const validation = validateRequired(payload.title, "Informe o nome do hábito.");
      if (validation) {
        context.toast.error(validation);
        return;
      }

      if (!activeDays.length) {
        context.toast.error("Selecione pelo menos um dia da semana.");
        return;
      }

      try {
        await persistHabit({ habit, payload });
      } catch (error) {
        context.toast.error(error.message || "Não foi possível salvar o hábito.");
      }
    });
  }

  async function removeHabits(ids) {
    await habitsService.deleteHabits(ids);
    const deletedIds = new Set(ids);
    state.habits = state.habits.filter((habit) => !deletedIds.has(habit.id));
    clearSelection();
    refreshContent();
  }

  function openDeleteHabitsModal(ids) {
    context.modal.open({
      title: ids.length > 1 ? "Excluir hábitos" : "Excluir hábito",
      description: ids.length > 1 ? `Deseja remover ${ids.length} hábitos da sua rotina?` : "Deseja remover este hábito da sua rotina?",
      content: "<p>Os hábitos serão desativados e deixarão de aparecer na lista.</p>",
      footer: `
        ${button("Cancelar", "ghost", 'type="button" data-close-modal')}
        ${button("Excluir", "danger", 'type="button" id="confirm-delete-habits"')}
      `
    });

    document.querySelector("#confirm-delete-habits").addEventListener("click", async () => {
      try {
        await removeHabits(ids);
        context.modal.close();
        context.toast.success(ids.length > 1 ? "Hábitos excluídos." : "Hábito excluído.");
      } catch (error) {
        context.toast.error(error.message || "Não foi possível excluir os hábitos.");
      }
    });
  }

  function bindHabitCard(root, element) {
    const habitId = element.dataset.habitId;
    let pressTimer = null;
    let longPressTriggered = false;

    const clearPressTimer = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("[data-action='edit']") || state.selectionMode) {
        return;
      }

      longPressTriggered = false;
      clearPressTimer();
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        enterSelectionMode(habitId);
        refreshContent(root);
      }, LONG_PRESS_MS);
    });

    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
      element.addEventListener(eventName, clearPressTimer);
    });

    element.addEventListener("click", async (event) => {
      if (event.target.closest("[data-action='edit']")) {
        return;
      }

      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }

      if (state.selectionMode) {
        toggleSelection(habitId);
        refreshContent(root);
        return;
      }

      await handleToggleHabit(habitId);
    });

    element.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      if (state.selectionMode) {
        toggleSelection(habitId);
        refreshContent(root);
        return;
      }

      await handleToggleHabit(habitId);
    });
  }

  function bind(root) {
    root.querySelector("#open-habit-modal")?.addEventListener("click", () => openHabitModal());
    root.querySelector("#empty-create-habit")?.addEventListener("click", () => openHabitModal());
    root.querySelector("#prev-habit-date")?.addEventListener("click", async () => changeSelectedDate(-1));
    root.querySelector("#next-habit-date")?.addEventListener("click", async () => changeSelectedDate(1));
    root.querySelector("#cancel-habit-selection")?.addEventListener("click", () => {
      clearSelection();
      refreshContent(root);
    });
    root.querySelector("#delete-selected-habits")?.addEventListener("click", () => {
      if (state.selectedHabitIds.length) {
        openDeleteHabitsModal(state.selectedHabitIds);
      }
    });

    root.querySelectorAll("[data-action='edit']").forEach((element) => {
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        const habit = state.habits.find((item) => item.id === element.dataset.id);
        if (habit) {
          openHabitModal(habit);
        }
      });
    });

    root.querySelectorAll("[data-habit-id]").forEach((element) => bindHabitCard(root, element));
  }

  return { render };
}
