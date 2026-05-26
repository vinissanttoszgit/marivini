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
const POINTER_CANCEL_DISTANCE = 10;
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
    selectedHabitIds: [],
    selectionMode: false
  };

  let iconPickerCleanup = null;
  let consumedLongPressHabitId = null;
  let consumedLongPressUntil = 0;

  function normalizeActiveDays(activeDays) {
    if (!Array.isArray(activeDays) || !activeDays.length) {
      return [...DEFAULT_ACTIVE_DAYS];
    }

    const uniqueDays = [
      ...new Set(
        activeDays
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      )
    ];

    return uniqueDays.length ? uniqueDays : [...DEFAULT_ACTIVE_DAYS];
  }

  function getSelectionSet() {
    return new Set(state.selectedHabitIds.map(String));
  }

  function getSelectedDateObject() {
    return parseISODate(state.selectedDate);
  }

  function getHabitSortValue(habit) {
    const position = Number(habit?.position);
    return Number.isFinite(position) ? position : Number.MAX_SAFE_INTEGER;
  }

  function sortHabits(habits) {
    return [...habits].sort((left, right) => {
      const positionDiff = getHabitSortValue(left) - getHabitSortValue(right);
      if (positionDiff !== 0) {
        return positionDiff;
      }

      const createdAtDiff = String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""));
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return String(left.id ?? "").localeCompare(String(right.id ?? ""));
    });
  }

  function getVisibleHabits() {
    const weekday = getWeekdayIndex(state.selectedDate);
    return state.habits.filter((habit) => normalizeActiveDays(habit.active_days).includes(weekday));
  }

  function getCompletedIds() {
    return new Set(state.selectedLogs.filter((log) => log.completed).map((log) => String(log.habit_id)));
  }

  function getDateLabel() {
    return formatHabitDateLabel(state.selectedDate);
  }

  function getExistingHabitPriority(habit) {
    const position = Number(habit?.position);
    return Number.isFinite(position) ? Math.max(1, position + 1) : 1;
  }

  function getDefaultNewHabitPriority() {
    return state.habits.length + 1;
  }

  function consumeLongPressClick(habitId) {
    consumedLongPressHabitId = String(habitId);
    consumedLongPressUntil = Date.now() + 400;
  }

  function shouldIgnoreLongPressClick(habitId) {
    const matchesTarget = consumedLongPressHabitId === String(habitId);
    const isActive = Date.now() < consumedLongPressUntil;

    if (matchesTarget && isActive) {
      consumedLongPressHabitId = null;
      consumedLongPressUntil = 0;
      return true;
    }

    if (!isActive) {
      consumedLongPressHabitId = null;
      consumedLongPressUntil = 0;
    }

    return false;
  }

  async function loadHabits() {
    state.habits = sortHabits(
      (await habitsService.listHabits()).map((habit) => ({
        ...habit,
        active_days: normalizeActiveDays(habit.active_days)
      }))
    );
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

  function getSelectionBarMarkup() {
    if (!state.selectionMode) {
      return "";
    }

    return `
      <section class="habit-selection-floating-bar" aria-label="Ações dos hábitos selecionados">
        ${button("Cancelar", "ghost", 'type="button" id="cancel-habit-selection"')}
        ${button(`Excluir ${state.selectedHabitIds.length}`, "danger", `type="button" id="delete-selected-habits" ${state.selectedHabitIds.length ? "" : "disabled"}`)}
      </section>
    `;
  }

  function getMarkup() {
    const visibleHabits = getVisibleHabits();
    const completedIds = getCompletedIds();
    const completed = visibleHabits.filter((habit) => completedIds.has(String(habit.id))).length;
    const selectionSet = getSelectionSet();

    return `
      <div class="page-stack ${state.selectionMode ? "page-stack--selection-mode" : ""}">
        <section class="card habit-date-nav" aria-label="Selecionar data">
          <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--prev" id="prev-habit-date" aria-label="Dia anterior"></button>
          <div class="habit-date-nav__label">${getDateLabel()}</div>
          <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--next" id="next-habit-date" aria-label="Próximo dia"></button>
        </section>
        ${progressCard({ completed, total: visibleHabits.length })}
        ${
          visibleHabits.length
            ? `<section class="habit-list">${visibleHabits
                .map((habit) =>
                  habitCard({
                    habit,
                    isCompleted: completedIds.has(String(habit.id)),
                    streakData: calculateHabitStatus(
                      state.recentLogs.filter((log) => String(log.habit_id) === String(habit.id)),
                      state.selectedDate
                    ),
                    isSelectionMode: state.selectionMode,
                    isSelected: selectionSet.has(String(habit.id))
                  })
                )
                .join("")}</section>`
            : emptyState({
                icon: "🌿",
                title: state.habits.length ? "Nada para este dia" : "Nenhum hábito criado",
                description: state.habits.length
                  ? "Escolha outro dia ou adicione um hábito para esta rotina."
                  : "Adicione seu primeiro hábito para começar a acompanhar sua rotina.",
                action: button(
                  state.habits.length ? "Adicionar hábito" : "Criar primeiro hábito",
                  "primary",
                  'id="empty-create-habit"'
                )
              })
        }
      </div>
      ${getSelectionBarMarkup()}
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
    const normalizedId = String(habitId);

    if (selectionSet.has(normalizedId)) {
      selectionSet.delete(normalizedId);
    } else {
      selectionSet.add(normalizedId);
    }

    state.selectedHabitIds = [...selectionSet];

    if (!state.selectedHabitIds.length) {
      clearSelection();
    }
  }

  function enterSelectionMode(habitId) {
    state.selectionMode = true;
    state.selectedHabitIds = [String(habitId)];
  }

  function updateLogCollections(habitId, completed) {
    const normalizedId = String(habitId);
    const matchesHabitAndDate = (log) =>
      String(log.habit_id) === normalizedId && log.log_date === state.selectedDate;

    state.selectedLogs = completed
      ? [
          ...state.selectedLogs.filter((log) => !matchesHabitAndDate(log)),
          { habit_id: habitId, log_date: state.selectedDate, completed: true }
        ]
      : state.selectedLogs.filter((log) => !matchesHabitAndDate(log));

    state.recentLogs = completed
      ? [
          ...state.recentLogs.filter((log) => !matchesHabitAndDate(log)),
          { habit_id: habitId, log_date: state.selectedDate, completed: true }
        ]
      : state.recentLogs.filter((log) => !matchesHabitAndDate(log));
  }

  async function handleToggleHabit(habitId) {
    const completedIds = getCompletedIds();
    const normalizedId = String(habitId);
    const willComplete = !completedIds.has(normalizedId);

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
    const previousDate = state.selectedDate;
    state.selectedDate = startOfDayISO(addDays(getSelectedDateObject(), amount));
    clearSelection();

    try {
      await loadSelectedDateData();
      refreshContent();
    } catch (error) {
      state.selectedDate = previousDate;
      context.toast.error(error.message || "Não foi possível carregar os hábitos deste dia.");
    }
  }

  async function persistHabit({ habit, payload }) {
    const savedHabit = habit
      ? await habitsService.updateHabit(habit.id, payload)
      : await habitsService.createHabit(payload);

    const normalizedHabit = {
      ...savedHabit,
      active_days: normalizeActiveDays(savedHabit.active_days)
    };

    state.habits = sortHabits(
      habit
        ? state.habits.map((item) =>
            String(item.id) === String(habit.id) ? normalizedHabit : item
          )
        : [...state.habits, normalizedHabit]
    );

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

  function bindPriorityStepper() {
    const hiddenInput = document.querySelector('#habit-form input[name="priority"]');
    const valueElement = document.querySelector("#habit-priority-value");
    const decrementButton = document.querySelector('[data-action="decrement-priority"]');
    const incrementButton = document.querySelector('[data-action="increment-priority"]');

    if (!hiddenInput || !valueElement || !decrementButton || !incrementButton) {
      return;
    }

    const syncValue = (nextValue) => {
      const normalizedValue = Math.max(1, Number(nextValue) || 1);
      hiddenInput.value = String(normalizedValue);
      valueElement.textContent = String(normalizedValue);
      decrementButton.disabled = normalizedValue <= 1;
    };

    decrementButton.addEventListener("click", () => {
      syncValue(Number(hiddenInput.value) - 1);
    });

    incrementButton.addEventListener("click", () => {
      syncValue(Number(hiddenInput.value) + 1);
    });

    syncValue(hiddenInput.value);
  }

  function bindIconPicker() {
    iconPickerCleanup?.();

    const trigger = document.querySelector("#habit-icon-trigger");
    const picker = document.querySelector("#habit-icon-picker");
    const hiddenInput = document.querySelector('#habit-form input[name="icon"]');
    const preview = document.querySelector("#selected-habit-icon");
    const group = document.querySelector(".habit-title-group");

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
        const icon = option.dataset.icon || "✨";
        hiddenInput.value = icon;
        preview.textContent = icon;

        picker.querySelectorAll(".habit-icon-option").forEach((buttonElement) => {
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

  function readSelectedWeekdays() {
    return WEEKDAY_OPTIONS.filter((option) =>
      document
        .querySelector(`.weekday-chip[data-day="${option.value}"]`)
        ?.classList.contains("is-selected")
    ).map((option) => option.value);
  }

  function openHabitModal(habit = null) {
    const selectedIcon = habit?.icon ?? "✨";
    const priority = habit ? getExistingHabitPriority(habit) : getDefaultNewHabitPriority();

    context.modal.open({
      title: habit ? "Editar hábito" : "Novo hábito",
      description: "",
      content: `
        <form class="form-stack" id="habit-form">
          <div class="habit-title-group">
            <label>
              Título
              <div class="habit-title-field">
                <input name="title" maxlength="80" value="${habit?.title ?? ""}" placeholder="Ex.: Ler 20 minutos" required />
                <button
                  type="button"
                  class="habit-icon-trigger"
                  id="habit-icon-trigger"
                  aria-label="Escolher ícone"
                  aria-expanded="false"
                >
                  <span id="selected-habit-icon">${selectedIcon}</span>
                </button>
                <input type="hidden" name="icon" value="${selectedIcon}" />
              </div>
            </label>
            <div class="habit-icon-picker" id="habit-icon-picker" hidden>
              ${EMOJI_OPTIONS.map(
                (emoji) => `
                  <button
                    type="button"
                    class="habit-icon-option ${selectedIcon === emoji ? "is-selected" : ""}"
                    data-icon="${emoji}"
                    aria-label="Selecionar ícone ${emoji}"
                  >
                    ${emoji}
                  </button>
                `
              ).join("")}
            </div>
          </div>
          <div class="priority-field">
            <span class="weekday-field__label">Prioridade</span>
            <div class="priority-stepper" aria-label="Prioridade do hábito">
              <button type="button" class="priority-stepper__button" data-action="decrement-priority" aria-label="Diminuir prioridade">-</button>
              <span class="priority-stepper__value" id="habit-priority-value">${priority}</span>
              <button type="button" class="priority-stepper__button" data-action="increment-priority" aria-label="Aumentar prioridade">+</button>
              <input type="hidden" name="priority" value="${priority}" />
            </div>
          </div>
          <div class="weekday-field">
            <span class="weekday-field__label">Frequência</span>
            ${getModalWeekdayMarkup(habit?.active_days)}
          </div>
        </form>
      `,
      footer: `
        ${button("Cancelar", "ghost", 'type="button" data-close-modal')}
        ${button(habit ? "Salvar alterações" : "Salvar hábito", "primary", 'type="submit" form="habit-form"')}
      `
    });

    bindIconPicker();
    bindPriorityStepper();
    bindWeekdayPicker();

    document.querySelector("#habit-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const activeDays = readSelectedWeekdays();
      const priorityValue = Math.max(1, Number(formData.get("priority")) || 1);
      const payload = {
        title: String(formData.get("title")).trim(),
        description: null,
        icon: String(formData.get("icon")).trim(),
        active_days: activeDays,
        position: priorityValue - 1
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
    const deletedIds = new Set(ids.map(String));

    state.habits = state.habits.filter((habit) => !deletedIds.has(String(habit.id)));
    clearSelection();
    refreshContent();
  }

  function openDeleteHabitsModal(ids) {
    context.modal.open({
      title: ids.length > 1 ? "Excluir hábitos" : "Excluir hábito",
      description:
        ids.length > 1
          ? `Deseja remover ${ids.length} hábitos da sua rotina?`
          : "Deseja remover este hábito da sua rotina?",
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

  function bindSelectionBar(root) {
    root.querySelector("#cancel-habit-selection")?.addEventListener("click", () => {
      clearSelection();
      refreshContent(root);
    });

    root.querySelector("#delete-selected-habits")?.addEventListener("click", () => {
      if (state.selectedHabitIds.length) {
        openDeleteHabitsModal(state.selectedHabitIds);
      }
    });
  }

  function bindHabitCard(root, element) {
    const habitId = String(element.dataset.habitId);
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
      if (event.button !== 0 || event.target.closest("[data-action='edit']")) {
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
        consumeLongPressClick(habitId);

        if (!state.selectionMode) {
          enterSelectionMode(habitId);
        } else if (!getSelectionSet().has(habitId)) {
          toggleSelection(habitId);
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

    element.addEventListener("click", async (event) => {
      if (event.target.closest("[data-action='edit']")) {
        return;
      }

      if (shouldIgnoreLongPressClick(habitId)) {
        event.preventDefault();
        event.stopPropagation();
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
    root.querySelector("#empty-create-habit")?.addEventListener("click", () => openHabitModal());
    root.querySelector("#prev-habit-date")?.addEventListener("click", async () => changeSelectedDate(-1));
    root.querySelector("#next-habit-date")?.addEventListener("click", async () => changeSelectedDate(1));

    bindSelectionBar(root);

    root.querySelectorAll("[data-action='edit']").forEach((element) => {
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        const habit = state.habits.find((item) => String(item.id) === String(element.dataset.id));

        if (habit) {
          openHabitModal(habit);
        }
      });
    });

    root.querySelectorAll("[data-habit-id]").forEach((element) => bindHabitCard(root, element));
  }

  return {
    render,
    openCreateHabitModal() {
      openHabitModal();
    }
  };
}
