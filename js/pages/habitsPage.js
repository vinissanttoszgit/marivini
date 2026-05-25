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
const DRAG_THRESHOLD_PX = 8;
const CLICK_GUARD_MS = 180;
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
    selectionMode: false,
    reorderSyncPending: false
  };

  let activeDrag = null;
  let suppressClickUntil = 0;

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
            ? `<section class="habit-list ${state.selectionMode ? "is-reorder-enabled" : ""}">${visibleHabits
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
      : await habitsService.createHabit({
          ...payload,
          position: state.habits.length
        });

    state.habits = habit
      ? state.habits.map((item) =>
          String(item.id) === String(habit.id)
            ? { ...savedHabit, active_days: normalizeActiveDays(savedHabit.active_days) }
            : item
        )
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

  function bindIconPicker() {
    const trigger = document.querySelector("#habit-icon-trigger");
    const picker = document.querySelector("#habit-icon-picker");
    const hiddenInput = document.querySelector('#habit-form input[name="icon"]');
    const preview = document.querySelector("#selected-habit-icon");

    if (!trigger || !picker || !hiddenInput || !preview) {
      return;
    }

    const setExpanded = (expanded) => {
      picker.hidden = !expanded;
      trigger.setAttribute("aria-expanded", String(expanded));
    };

    trigger.addEventListener("click", (event) => {
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

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".habit-title-group")) {
        setExpanded(false);
      }
    });
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

  function captureCardRects(list) {
    return new Map(
      [...list.querySelectorAll("[data-habit-id]")].map((element) => [
        element.dataset.habitId,
        element.getBoundingClientRect()
      ])
    );
  }

  function animateCardPositions(list, previousRects, skipId = null) {
    list.querySelectorAll("[data-habit-id]").forEach((element) => {
      const habitId = element.dataset.habitId;
      if (habitId === skipId) {
        return;
      }

      const previousRect = previousRects.get(habitId);
      if (!previousRect) {
        return;
      }

      const nextRect = element.getBoundingClientRect();
      const deltaY = previousRect.top - nextRect.top;

      if (!deltaY) {
        return;
      }

      element.style.transition = "none";
      element.style.transform = `translateY(${deltaY}px)`;

      requestAnimationFrame(() => {
        element.style.transition = "transform 180ms ease";
        element.style.transform = "";

        window.setTimeout(() => {
          if (!element.classList.contains("is-dragging")) {
            element.style.transition = "";
          }
        }, 200);
      });
    });
  }

  function lockDragScroll() {
    document.body.classList.add("is-habit-dragging");
  }

  function unlockDragScroll() {
    document.body.classList.remove("is-habit-dragging");
  }

  function syncSelectionUi(root) {
    const pageStack = root.querySelector(".page-stack");
    const list = root.querySelector(".habit-list");
    const selectionSet = getSelectionSet();

    pageStack?.classList.toggle("page-stack--selection-mode", state.selectionMode);
    list?.classList.toggle("is-reorder-enabled", state.selectionMode);

    root.querySelectorAll("[data-habit-id]").forEach((cardElement) => {
      const isSelected = selectionSet.has(String(cardElement.dataset.habitId));
      const checkElement = cardElement.querySelector(".habit-card__check");
      const titleElement = cardElement.querySelector(".habit-card__title");
      const title = titleElement?.textContent?.trim() || "";

      cardElement.classList.toggle("is-selection-mode", state.selectionMode);
      cardElement.classList.toggle("is-selected", isSelected);
      cardElement.setAttribute("aria-pressed", String(state.selectionMode ? isSelected : cardElement.classList.contains("is-complete")));
      cardElement.setAttribute(
        "aria-label",
        state.selectionMode ? `Selecionar ${title}` : `Marcar hábito ${title}`
      );

      if (checkElement) {
        checkElement.textContent = state.selectionMode
          ? isSelected
            ? "✓"
            : ""
          : cardElement.classList.contains("is-complete")
            ? "✓"
            : "";
      }
    });

    const existingBar = root.querySelector(".habit-selection-floating-bar");
    if (state.selectionMode) {
      if (existingBar) {
        existingBar.outerHTML = getSelectionBarMarkup();
      } else {
        root.insertAdjacentHTML("beforeend", getSelectionBarMarkup());
      }

      bindSelectionBar(root);
    } else {
      existingBar?.remove();
    }
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

  function getPlaceholderAnchor(list, draggedElement, draggedCenterY) {
    const siblings = [...list.querySelectorAll("[data-habit-id]")].filter((element) => element !== draggedElement);

    for (const sibling of siblings) {
      const rect = sibling.getBoundingClientRect();
      if (draggedCenterY < rect.top + rect.height / 2) {
        return sibling;
      }
    }

    return null;
  }

  function movePlaceholder(list, placeholder, draggedElement, draggedCenterY) {
    const anchor = getPlaceholderAnchor(list, draggedElement, draggedCenterY);
    const target = anchor ?? null;

    if (target === placeholder.nextElementSibling || (!target && list.lastElementChild === placeholder)) {
      return;
    }

    const previousRects = captureCardRects(list);

    if (target) {
      list.insertBefore(placeholder, target);
    } else {
      list.appendChild(placeholder);
    }

    animateCardPositions(list, previousRects, activeDrag?.habitId ?? null);
  }

  function startDrag(root, element, pointerId, clientX, clientY) {
    if (activeDrag) {
      return;
    }

    const list = root.querySelector(".habit-list");
    if (!list) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const placeholder = document.createElement("div");
    placeholder.className = "habit-drag-placeholder";
    placeholder.style.height = `${rect.height}px`;
    placeholder.style.width = `${rect.width}px`;

    list.insertBefore(placeholder, element.nextSibling);

    element.classList.add("is-dragging");
    list.classList.add("is-reordering");
    lockDragScroll();

    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;

    activeDrag = {
      habitId: String(element.dataset.habitId),
      pointerId,
      element,
      placeholder,
      list,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top
    };

    element.setPointerCapture?.(pointerId);
    updateDraggedPosition(clientX, clientY);
  }

  function updateDraggedPosition(clientX, clientY) {
    if (!activeDrag) {
      return;
    }

    const { element, offsetY, offsetX, list, placeholder } = activeDrag;
    const top = clientY - offsetY;
    const left = clientX - offsetX;
    const centerY = top + element.offsetHeight / 2;

    element.style.transform = `translate3d(${left - parseFloat(element.style.left)}px, ${top - parseFloat(element.style.top)}px, 0)`;
    movePlaceholder(list, placeholder, element, centerY);
  }

  function applyVisibleOrder(orderedVisibleIds) {
    const visibleMap = new Map(getVisibleHabits().map((habit) => [String(habit.id), habit]));
    const reorderedVisibleHabits = orderedVisibleIds
      .map((habitId) => visibleMap.get(String(habitId)))
      .filter(Boolean);
    const orderedVisibleSet = new Set(orderedVisibleIds.map(String));
    let visibleIndex = 0;

    state.habits = state.habits
      .map((habit) =>
        orderedVisibleSet.has(String(habit.id)) ? reorderedVisibleHabits[visibleIndex++] : habit
      )
      .map((habit, index) => ({
        ...habit,
        position: index
      }));
  }

  async function persistVisibleOrder(root, list) {
    if (state.reorderSyncPending) {
      return;
    }

    const previousHabits = state.habits.map((habit) => ({ ...habit }));
    const orderedVisibleIds = [...list.querySelectorAll("[data-habit-id]")].map(
      (element) => element.dataset.habitId
    );

    applyVisibleOrder(orderedVisibleIds);
    state.reorderSyncPending = true;

    try {
      await habitsService.reorderHabits(state.habits);
    } catch (error) {
      state.habits = previousHabits;
      refreshContent(root);
      context.toast.error(error.message || "Não foi possível salvar a nova ordem.");
    } finally {
      state.reorderSyncPending = false;
    }
  }

  async function finishDrag(root) {
    if (!activeDrag) {
      return;
    }

    const { element, placeholder, list, pointerId } = activeDrag;
    activeDrag = null;

    suppressClickUntil = Date.now() + CLICK_GUARD_MS;

    if (element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture(pointerId);
    }

    list.insertBefore(element, placeholder);
    placeholder.remove();

    element.classList.remove("is-dragging");
    list.classList.remove("is-reordering");

    element.style.width = "";
    element.style.height = "";
    element.style.left = "";
    element.style.top = "";
    element.style.transform = "";

    unlockDragScroll();

    await persistVisibleOrder(root, list);
  }

  function bindHabitCard(root, element) {
    const habitId = String(element.dataset.habitId);
    let pressTimer = null;
    let movedBeforeLongPress = false;
    let longPressTriggered = false;
    let pointerSession = null;

    const clearPressTimer = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const cleanupSession = () => {
      clearPressTimer();
      pointerSession = null;
      movedBeforeLongPress = false;
      longPressTriggered = false;
    };

    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("[data-action='edit']") || activeDrag) {
        return;
      }

      pointerSession = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        dragged: false
      };

      movedBeforeLongPress = false;
      longPressTriggered = false;

      clearPressTimer();
      pressTimer = setTimeout(() => {
        if (!pointerSession || (!state.selectionMode && movedBeforeLongPress)) {
          return;
        }

        if (!state.selectionMode) {
          enterSelectionMode(habitId);
          syncSelectionUi(root);
        }

        longPressTriggered = true;
        pointerSession.dragged = true;
        startDrag(root, element, event.pointerId, pointerSession.lastX, pointerSession.lastY);
      }, LONG_PRESS_MS);
    });

    element.addEventListener("pointermove", (event) => {
      if (!pointerSession || pointerSession.pointerId !== event.pointerId) {
        return;
      }

      pointerSession.lastX = event.clientX;
      pointerSession.lastY = event.clientY;

      const deltaX = event.clientX - pointerSession.startX;
      const deltaY = event.clientY - pointerSession.startY;
      const movedEnough = Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX;

      if (!activeDrag && movedEnough && !state.selectionMode) {
        movedBeforeLongPress = true;
      }

      if (activeDrag && activeDrag.pointerId === event.pointerId) {
        event.preventDefault();
        updateDraggedPosition(event.clientX, event.clientY);
      }
    });

    const handlePointerEnd = async (event) => {
      if (!pointerSession || pointerSession.pointerId !== event.pointerId) {
        return;
      }

      const wasDragging = activeDrag && activeDrag.pointerId === event.pointerId;

      if (wasDragging) {
        event.preventDefault();
        await finishDrag(root);
        cleanupSession();
        return;
      }

      cleanupSession();
    };

    element.addEventListener("pointerup", handlePointerEnd);
    element.addEventListener("pointercancel", handlePointerEnd);
    element.addEventListener("pointerleave", () => {
      if (!activeDrag) {
        clearPressTimer();
      }
    });

    element.addEventListener("click", async (event) => {
      if (event.target.closest("[data-action='edit']")) {
        return;
      }

      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        return;
      }

      if (longPressTriggered) {
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
