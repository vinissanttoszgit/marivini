import habitsService from "../services/habitsService.js";
import habitLogsService from "../services/habitLogsService.js";
import habitScheduleOverridesService from "../services/habitScheduleOverridesService.js";
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

const EMOJI_OPTIONS = ["✨", "📚", "💧", "🏃", "🧘", "🍎", "💻", "🌙", "🏋️", "🧹", "💊", "🎯"];
const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5, 6, 0];
const LONG_PRESS_MS = 500;
const POINTER_CANCEL_DISTANCE = 10;
const HABIT_PRELOAD_RADIUS = 3;
const WEEK_LENGTH = 7;
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
    habitDataByDate: {},
    dateErrorsByDate: {},
    selectedDate: todayISO(),
    summaryWeekStart: null,
    viewMode: "list",
    weeklySummaryByWeekStart: {},
    weeklySummaryErrorsByWeekStart: {},
    selectedHabitIds: [],
    selectionMode: false
  };

  let iconPickerCleanup = null;
  let consumedLongPressHabitId = null;
  let consumedLongPressUntil = 0;
  let renderedViewUserId = null;
  const pendingDateRequests = new Map();
  const pendingWeeklySummaryRequests = new Map();
  const dateRequestVersions = new Map();
  const weeklySummaryRequestVersions = new Map();

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

  function createEmptyDateData() {
    return {
      selectedLogs: [],
      recentLogs: [],
      scheduleOverrides: []
    };
  }

  function resetDateCaches() {
    state.habitDataByDate = {};
    state.dateErrorsByDate = {};
    pendingDateRequests.clear();
    dateRequestVersions.clear();
  }

  function resetWeeklySummaryCaches() {
    state.weeklySummaryByWeekStart = {};
    state.weeklySummaryErrorsByWeekStart = {};
    pendingWeeklySummaryRequests.clear();
    weeklySummaryRequestVersions.clear();
  }

  function getSelectionSet() {
    return new Set(state.selectedHabitIds.map(String));
  }

  function getSelectedDateObject() {
    return parseISODate(state.selectedDate);
  }

  function getSummaryWeekStart() {
    return state.summaryWeekStart ?? getWeekStartISO(state.selectedDate);
  }

  function getDateData(date = state.selectedDate) {
    return state.habitDataByDate[date] ?? null;
  }

  function getWeeklySummary(weekStart = getSummaryWeekStart()) {
    return state.weeklySummaryByWeekStart[weekStart] ?? null;
  }

  function ensureDateCacheEntry(date) {
    if (!state.habitDataByDate[date]) {
      state.habitDataByDate[date] = createEmptyDateData();
    }

    return state.habitDataByDate[date];
  }

  function getWeekStartISO(date) {
    const dateObject = parseISODate(date);
    const weekday = dateObject.getDay();
    const offset = weekday === 0 ? -6 : 1 - weekday;
    return startOfDayISO(addDays(dateObject, offset));
  }

  function getWeekDates(weekStart) {
    const weekStartDate = parseISODate(weekStart);
    return Array.from({ length: WEEK_LENGTH }, (_, index) => startOfDayISO(addDays(weekStartDate, index)));
  }

  function formatWeekRange(weekStart) {
    const weekDates = getWeekDates(weekStart);
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      day: "numeric",
      month: "short"
    });

    return `${formatter.format(parseISODate(weekDates[0]))} - ${formatter.format(parseISODate(weekDates[6]))}`;
  }

  function isDateLoading(date) {
    return pendingDateRequests.has(date);
  }

  function isWeeklySummaryLoading(weekStart = getSummaryWeekStart()) {
    return pendingWeeklySummaryRequests.has(weekStart);
  }

  function bumpDateRequestVersions(matchDate) {
    const dates = new Set([...Object.keys(state.habitDataByDate), ...pendingDateRequests.keys()]);

    dates.forEach((cacheDate) => {
      if (!matchDate(cacheDate)) {
        return;
      }

      dateRequestVersions.set(cacheDate, (dateRequestVersions.get(cacheDate) ?? 0) + 1);
    });
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

  function getActiveDateData() {
    return getDateData() ?? createEmptyDateData();
  }

  function getVisibleHabits() {
    const activeDateData = getActiveDateData();

    return sortHabits(
      state.habits
        .map((habit) => ({
          ...habit,
          schedule: getVisibleHabitSchedule(habit, activeDateData.scheduleOverrides)
        }))
        .filter((habit) => habit.schedule)
    );
  }

  function getHabitScheduleForDate(habit, date, scheduleOverrides = []) {
    const habitId = String(habit.id);
    const targetOverride = scheduleOverrides.find(
      (override) => String(override.habit_id) === habitId && override.target_date === date
    );

    if (targetOverride) {
      return {
        isPostponed: true,
        originalDate: targetOverride.original_date,
        scheduledDate: date,
        overrideId: targetOverride.id
      };
    }

    const originalOverride = scheduleOverrides.find(
      (override) => String(override.habit_id) === habitId && override.original_date === date
    );

    if (originalOverride && originalOverride.target_date !== date) {
      return null;
    }

    if (normalizeActiveDays(habit.active_days).includes(getWeekdayIndex(date))) {
      return {
        isPostponed: false,
        originalDate: date,
        scheduledDate: date,
        overrideId: null
      };
    }

    return null;
  }

  function hasHabitOccurrenceOnDate(habit, date, scheduleOverrides) {
    return Boolean(getHabitScheduleForDate(habit, date, scheduleOverrides));
  }

  function getVisibleHabitSchedule(habit, scheduleOverrides) {
    return getHabitScheduleForDate(habit, state.selectedDate, scheduleOverrides);
  }

  function buildWeeklySummary(weekStart, logs, scheduleOverrides) {
    const completedIdsByDate = logs.reduce((accumulator, log) => {
      if (!log.completed) {
        return accumulator;
      }

      const dateKey = log.log_date;
      accumulator[dateKey] = accumulator[dateKey] ?? new Set();
      accumulator[dateKey].add(String(log.habit_id));
      return accumulator;
    }, {});

    const days = getWeekDates(weekStart).map((date, index) => {
      const completedIds = completedIdsByDate[date] ?? new Set();
      const scheduledHabits = state.habits.filter((habit) =>
        hasHabitOccurrenceOnDate(habit, date, scheduleOverrides)
      );
      const total = scheduledHabits.length;
      const completed = scheduledHabits.filter((habit) => completedIds.has(String(habit.id))).length;

      return {
        date,
        label: WEEKDAY_OPTIONS[index]?.label ?? "",
        completed,
        total,
        percentage: total ? Math.round((completed / total) * 100) : 0
      };
    });

    const completed = days.reduce((sum, day) => sum + day.completed, 0);
    const total = days.reduce((sum, day) => sum + day.total, 0);

    return {
      weekStart,
      weekEnd: days[days.length - 1]?.date ?? weekStart,
      days,
      completed,
      total,
      percentage: total ? Math.round((completed / total) * 100) : 0
    };
  }

  function canPostponeHabit(habit, completedIds) {
    const activeDateData = getActiveDateData();

    if (context.isReadOnly() || state.selectionMode || completedIds.has(String(habit.id))) {
      return false;
    }

    if (!hasHabitOccurrenceOnDate(habit, state.selectedDate, activeDateData.scheduleOverrides)) {
      return false;
    }

    const tomorrow = startOfDayISO(addDays(getSelectedDateObject(), 1));
    return !hasHabitOccurrenceOnDate(habit, tomorrow, activeDateData.scheduleOverrides);
  }

  function getCompletedIds() {
    return new Set(
      getActiveDateData()
        .selectedLogs.filter((log) => log.completed)
        .map((log) => String(log.habit_id))
    );
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

  async function fetchWeeklySummaryData(weekStart) {
    const weekDates = getWeekDates(weekStart);
    const weekEnd = weekDates[weekDates.length - 1];
    const [logs, scheduleOverrides] = await Promise.all([
      habitLogsService.listLogsRange({
        startDate: weekStart,
        endDate: weekEnd
      }),
      habitScheduleOverridesService.listOverridesRange({
        startDate: weekStart,
        endDate: weekEnd
      })
    ]);

    return buildWeeklySummary(weekStart, logs, scheduleOverrides);
  }

  async function fetchDateData(date) {
    const selectedDateObject = parseISODate(date);
    const startDate = startOfDayISO(addDays(selectedDateObject, -60));
    const logEndDate = endOfDayISO(selectedDateObject);
    const overrideEndDate = endOfDayISO(addDays(selectedDateObject, 1));

    const [selectedLogs, recentLogs, scheduleOverrides] = await Promise.all([
      habitLogsService.listLogsByDate(date),
      habitLogsService.listLogsRange({
        startDate,
        endDate: logEndDate
      }),
      habitScheduleOverridesService.listOverridesRange({
        startDate,
        endDate: overrideEndDate
      })
    ]);

    return {
      selectedLogs,
      recentLogs,
      scheduleOverrides
    };
  }

  async function ensureDateData(date, { force = false, silent = false } = {}) {
    if (!force && getDateData(date)) {
      return getDateData(date);
    }

    if (!force && pendingDateRequests.has(date)) {
      return pendingDateRequests.get(date);
    }

    const requestVersion = (dateRequestVersions.get(date) ?? 0) + 1;
    dateRequestVersions.set(date, requestVersion);
    delete state.dateErrorsByDate[date];

    const request = fetchDateData(date)
      .then((payload) => {
        if (dateRequestVersions.get(date) !== requestVersion) {
          return getDateData(date);
        }

        state.habitDataByDate[date] = payload;
        delete state.dateErrorsByDate[date];

        if (state.selectedDate === date) {
          refreshContent();
        }

        return payload;
      })
      .catch((error) => {
        if (dateRequestVersions.get(date) === requestVersion) {
          state.dateErrorsByDate[date] = error.message || "Não foi possível carregar os hábitos deste dia.";
        }

        if (!silent && state.selectedDate === date) {
          context.toast.error(state.dateErrorsByDate[date]);
          refreshContent();
        }

        throw error;
      })
      .finally(() => {
        if (pendingDateRequests.get(date) === request) {
          pendingDateRequests.delete(date);
        }

        if (state.selectedDate === date && state.dateErrorsByDate[date] && !getDateData(date)) {
          refreshContent();
        }
      });

    pendingDateRequests.set(date, request);
    return request;
  }

  async function ensureWeeklySummaryData(weekStart, { force = false, silent = false } = {}) {
    if (!force && getWeeklySummary(weekStart)) {
      return getWeeklySummary(weekStart);
    }

    if (!force && pendingWeeklySummaryRequests.has(weekStart)) {
      return pendingWeeklySummaryRequests.get(weekStart);
    }

    const requestVersion = (weeklySummaryRequestVersions.get(weekStart) ?? 0) + 1;
    weeklySummaryRequestVersions.set(weekStart, requestVersion);
    delete state.weeklySummaryErrorsByWeekStart[weekStart];

    const request = fetchWeeklySummaryData(weekStart)
      .then((payload) => {
        if (weeklySummaryRequestVersions.get(weekStart) !== requestVersion) {
          return getWeeklySummary(weekStart);
        }

        state.weeklySummaryByWeekStart[weekStart] = payload;
        delete state.weeklySummaryErrorsByWeekStart[weekStart];

        if (state.viewMode === "weeklySummary" && getSummaryWeekStart() === weekStart) {
          refreshContent();
        }

        return payload;
      })
      .catch((error) => {
        if (weeklySummaryRequestVersions.get(weekStart) === requestVersion) {
          state.weeklySummaryErrorsByWeekStart[weekStart] =
            error.message || "NÃ£o foi possÃ­vel carregar o resumo semanal.";
        }

        if (state.viewMode === "weeklySummary" && getSummaryWeekStart() === weekStart && !silent) {
          context.toast.error(state.weeklySummaryErrorsByWeekStart[weekStart]);
          refreshContent();
        }

        throw error;
      })
      .finally(() => {
        if (pendingWeeklySummaryRequests.get(weekStart) === request) {
          pendingWeeklySummaryRequests.delete(weekStart);
        }

        if (
          state.viewMode === "weeklySummary" &&
          getSummaryWeekStart() === weekStart &&
          state.weeklySummaryErrorsByWeekStart[weekStart] &&
          !getWeeklySummary(weekStart)
        ) {
          refreshContent();
        }
      });

    pendingWeeklySummaryRequests.set(weekStart, request);
    return request;
  }

  function preloadDateWindow(centerDate) {
    const centerDateObject = parseISODate(centerDate);

    for (let offset = -HABIT_PRELOAD_RADIUS; offset <= HABIT_PRELOAD_RADIUS; offset += 1) {
      const date = startOfDayISO(addDays(centerDateObject, offset));

      if (date === centerDate) {
        continue;
      }

      ensureDateData(date, { silent: true }).catch(() => {});
    }
  }

  function updateCachedLogCollections({ habitId, date, completed }) {
    const normalizedId = String(habitId);
    const matchesHabitAndDate = (log) => String(log.habit_id) === normalizedId && log.log_date === date;

    bumpDateRequestVersions((cacheDate) => cacheDate >= date);

    Object.keys(state.habitDataByDate).forEach((cacheDate) => {
      if (cacheDate < date) {
        return;
      }

      const cacheEntry = ensureDateCacheEntry(cacheDate);
      cacheEntry.recentLogs = completed
        ? [
            ...cacheEntry.recentLogs.filter((log) => !matchesHabitAndDate(log)),
            { habit_id: habitId, log_date: date, completed: true }
          ]
        : cacheEntry.recentLogs.filter((log) => !matchesHabitAndDate(log));

      if (cacheDate === date) {
        cacheEntry.selectedLogs = completed
          ? [
              ...cacheEntry.selectedLogs.filter((log) => !matchesHabitAndDate(log)),
              { habit_id: habitId, log_date: date, completed: true }
            ]
          : cacheEntry.selectedLogs.filter((log) => !matchesHabitAndDate(log));
      }
    });
  }

  function mergeOverrideIntoCaches(override) {
    bumpDateRequestVersions((cacheDate) => cacheDate >= override.original_date);

    Object.keys(state.habitDataByDate).forEach((cacheDate) => {
      if (cacheDate < override.original_date) {
        return;
      }

      const cacheEntry = ensureDateCacheEntry(cacheDate);
      cacheEntry.scheduleOverrides = [
        ...cacheEntry.scheduleOverrides.filter((item) => String(item.id) !== String(override.id)),
        override
      ];
    });
  }

  async function load() {
    await Promise.all([loadHabits(), ensureDateData(state.selectedDate, { force: true })]);
    preloadDateWindow(state.selectedDate);
  }

  async function render(root) {
    const activeUserId = context.getViewContext().activeUserId;
    if (renderedViewUserId !== activeUserId) {
      clearSelection();
      resetDateCaches();
      resetWeeklySummaryCaches();
      state.viewMode = "list";
      state.summaryWeekStart = null;
      renderedViewUserId = activeUserId;
    }

    context.setHeader({
      eyebrow: "",
      title: "Hábitos",
      subtitle: ""
    });

    root.innerHTML = loadingState({ variant: "habits", dateLabel: getDateLabel() });

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
    if (!state.selectionMode || context.isReadOnly()) {
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
    if (state.viewMode === "weeklySummary") {
      return getWeeklySummaryMarkup();
    }

    const canEdit = !context.isReadOnly();
    const activeDateData = getDateData();
    const currentDateError = state.dateErrorsByDate[state.selectedDate];

    if (!activeDateData && isDateLoading(state.selectedDate)) {
      return `
        <div class="page-stack ${state.selectionMode && canEdit ? "page-stack--selection-mode" : ""}">
          ${loadingState({ variant: "habits", dateLabel: getDateLabel() })}
        </div>
      `;
    }

    const visibleHabits = getVisibleHabits();
    const completedIds = getCompletedIds();
    const completed = visibleHabits.filter((habit) => completedIds.has(String(habit.id))).length;
    const selectionSet = getSelectionSet();

    return `
      <div class="page-stack ${state.selectionMode && canEdit ? "page-stack--selection-mode" : ""}">
        <section class="card habit-date-nav" aria-label="Selecionar data">
          <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--prev" id="prev-habit-date" aria-label="Dia anterior"></button>
          <button class="habit-date-nav__label habit-date-nav__label-button" id="reset-habit-date" type="button" aria-label="Voltar para hoje">${getDateLabel()}</button>
          <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--next" id="next-habit-date" aria-label="Próximo dia"></button>
        </section>
        ${progressCard({
          completed,
          total: visibleHabits.length,
          hint: "Ver resumo da semana",
          interactive: true,
          attributes: 'id="open-habit-weekly-summary" aria-label="Ver resumo semanal dos hábitos"'
        })}
        ${
          currentDateError && !activeDateData
            ? emptyState({
                icon: "⚠️",
                title: "Falha ao carregar",
                description: "Tente navegar novamente para este dia."
              })
            : visibleHabits.length
              ? `<section class="habit-list">${visibleHabits
                  .map((habit) =>
                    habitCard({
                      habit,
                      isCompleted: completedIds.has(String(habit.id)),
                      streakData: calculateHabitStatus(
                        activeDateData.recentLogs.filter((log) => String(log.habit_id) === String(habit.id)),
                        state.selectedDate,
                        {
                          habit,
                          overrides: activeDateData.scheduleOverrides
                        }
                      ),
                      isSelectionMode: state.selectionMode && canEdit,
                      isSelected: canEdit && selectionSet.has(String(habit.id)),
                      canEdit,
                      canPostpone: canPostponeHabit(habit, completedIds)
                    })
                  )
                  .join("")}</section>`
              : emptyState({
                  icon: "🌿",
                  title: state.habits.length ? "Nada para este dia" : "Nenhum hábito criado",
                  description: state.habits.length
                    ? "Escolha outro dia ou adicione um hábito para esta rotina."
                    : "Adicione seu primeiro hábito para começar a acompanhar sua rotina.",
                  action: canEdit
                    ? button(
                        state.habits.length ? "Adicionar hábito" : "Criar primeiro hábito",
                        "primary",
                        'id="empty-create-habit"'
                      )
                    : ""
                })
        }
      </div>
      ${getSelectionBarMarkup()}
    `;
  }

  function getWeeklySummaryMarkup() {
    const weekStart = getSummaryWeekStart();
    const summary = getWeeklySummary(weekStart);
    const summaryError = state.weeklySummaryErrorsByWeekStart[weekStart];

    if (!summary && isWeeklySummaryLoading(weekStart)) {
      return `
        <div class="page-stack">
          ${loadingState({ variant: "habits", dateLabel: "Resumo semanal" })}
        </div>
      `;
    }

    if (!summary) {
      return `
        <div class="page-stack">
          <section class="card weekly-summary-header">
            ${button("Voltar", "ghost", 'type="button" id="close-habit-weekly-summary"')}
            <div class="weekly-summary-header__body">
              <p class="eyebrow">Resumo semanal</p>
              <h2 class="weekly-summary-header__title">${formatWeekRange(weekStart)}</h2>
            </div>
          </section>
          ${emptyState({
            icon: "!",
            title: "Falha ao carregar",
            description: summaryError || "Tente navegar novamente para esta semana."
          })}
        </div>
      `;
    }

    return `
      <div class="page-stack">
        <section class="card weekly-summary-header">
          ${button("Voltar", "ghost", 'type="button" id="close-habit-weekly-summary"')}
          <div class="weekly-summary-header__body">
            <p class="eyebrow">Resumo semanal</p>
            <h2 class="weekly-summary-header__title">${formatWeekRange(weekStart)}</h2>
            <p class="weekly-summary-header__subtitle">De segunda a domingo</p>
          </div>
        </section>
        <section class="card habit-date-nav" aria-label="Navegar semanas">
          <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--prev" id="prev-habit-week" aria-label="Semana anterior"></button>
          <div class="habit-date-nav__label">${formatWeekRange(weekStart)}</div>
          <button class="icon-button habit-date-nav__arrow habit-date-nav__arrow--next" id="next-habit-week" aria-label="Proxima semana"></button>
        </section>
        ${progressCard({
          completed: summary.completed,
          total: summary.total,
          label: "Media da semana"
        })}
        <section class="card weekly-summary-card">
          <div class="weekly-summary-card__top">
            <div>
              <p class="eyebrow">Total geral</p>
              <div class="weekly-summary-card__value">${summary.completed}/${summary.total} habitos concluidos</div>
            </div>
            <div class="pill">${summary.percentage}% na semana</div>
          </div>
          <div class="weekly-summary-chart" aria-label="Desempenho da semana">
            ${summary.days
              .map(
                (day) => `
                  <div class="weekly-summary-chart__row">
                    <div class="weekly-summary-chart__day">${day.label}</div>
                    <div class="weekly-summary-chart__bar-group">
                      <div class="weekly-summary-chart__meta">
                        <span>${day.percentage}%</span>
                        <span>${day.completed}/${day.total}</span>
                      </div>
                      <div class="progress-bar weekly-summary-chart__bar">
                        <div class="progress-bar__fill" style="width: ${day.percentage}%"></div>
                      </div>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </section>
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

  function openWeeklySummary() {
    const weekStart = getWeekStartISO(state.selectedDate);
    state.summaryWeekStart = weekStart;
    state.viewMode = "weeklySummary";
    clearSelection();
    ensureWeeklySummaryData(weekStart).catch(() => {});
    refreshContent();
  }

  function closeWeeklySummary() {
    state.viewMode = "list";
    refreshContent();
  }

  function changeSummaryWeek(amount) {
    const nextWeekStart = startOfDayISO(addDays(parseISODate(getSummaryWeekStart()), amount * WEEK_LENGTH));
    const hasCachedSummary = Boolean(getWeeklySummary(nextWeekStart));

    state.summaryWeekStart = nextWeekStart;
    ensureWeeklySummaryData(nextWeekStart).catch(() => {});
    refreshContent();

    if (hasCachedSummary) {
      delete state.weeklySummaryErrorsByWeekStart[nextWeekStart];
    }
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
    ensureDateCacheEntry(state.selectedDate);
    updateCachedLogCollections({ habitId, date: state.selectedDate, completed });
    resetWeeklySummaryCaches();
  }

  async function handleToggleHabit(habitId) {
    if (context.isReadOnly()) {
      return;
    }

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

  async function handlePostponeHabit(habitId) {
    if (context.isReadOnly()) {
      return;
    }

    const normalizedId = String(habitId);
    const habit = getVisibleHabits().find((item) => String(item.id) === normalizedId);

    if (!habit || getCompletedIds().has(normalizedId)) {
      return;
    }

    const targetDate = startOfDayISO(addDays(getSelectedDateObject(), 1));

    try {
      const override = await habitScheduleOverridesService.postponeHabitOccurrence({
        habitId,
        originalDate: habit.schedule?.originalDate ?? state.selectedDate,
        targetDate
      });

      mergeOverrideIntoCaches(override);
      resetWeeklySummaryCaches();
      clearSelection();
      refreshContent();
      preloadDateWindow(state.selectedDate);
      preloadDateWindow(targetDate);
      context.toast.success("Hábito adiado para amanhã.");
    } catch (error) {
      context.toast.error(error.message || "Não foi possível adiar o hábito.");
    }
  }

  async function changeSelectedDate(amount) {
    const nextDate = startOfDayISO(addDays(getSelectedDateObject(), amount));
    const hasCachedData = Boolean(getDateData(nextDate));

    state.selectedDate = nextDate;
    clearSelection();
    ensureDateData(nextDate).catch(() => {});
    preloadDateWindow(nextDate);
    refreshContent();

    if (hasCachedData) {
      delete state.dateErrorsByDate[nextDate];
    }
  }

  async function resetSelectedDate() {
    const currentDate = todayISO();

    if (state.selectedDate === currentDate) {
      return;
    }

    const hasCachedData = Boolean(getDateData(currentDate));
    state.selectedDate = currentDate;
    clearSelection();
    ensureDateData(currentDate).catch(() => {});
    preloadDateWindow(currentDate);
    refreshContent();

    if (hasCachedData) {
      delete state.dateErrorsByDate[currentDate];
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
    resetWeeklySummaryCaches();
    context.modal.close();
    refreshContent();
    preloadDateWindow(state.selectedDate);
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
    if (context.isReadOnly()) {
      return;
    }

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
          <div class="weekday-field">
            <span class="weekday-field__label">Frequência</span>
            ${getModalWeekdayMarkup(habit?.active_days)}
          </div>
          <div class="priority-field">
            <span class="weekday-field__label">Prioridade</span>
            <div class="priority-stepper" aria-label="Prioridade do hábito">
              <button type="button" class="priority-stepper__button icon-minus" data-action="decrement-priority" aria-label="Diminuir prioridade"></button>
              <span class="priority-stepper__value" id="habit-priority-value">${priority}</span>
              <button type="button" class="priority-stepper__button icon-plus" data-action="increment-priority" aria-label="Aumentar prioridade"></button>
              <input type="hidden" name="priority" value="${priority}" />
            </div>
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
    resetWeeklySummaryCaches();
    clearSelection();
    refreshContent();
  }

  function openDeleteHabitsModal(ids) {
    if (context.isReadOnly()) {
      return;
    }

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
    if (context.isReadOnly()) {
      return;
    }

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
    if (context.isReadOnly()) {
      return;
    }

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
      if (event.button !== 0 || event.target.closest("[data-action='edit'], [data-action='postpone']")) {
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
      if (event.target.closest("[data-action='edit'], [data-action='postpone']")) {
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
    root.querySelector("#open-habit-weekly-summary")?.addEventListener("click", () => openWeeklySummary());
    root.querySelector("#close-habit-weekly-summary")?.addEventListener("click", () => closeWeeklySummary());
    root.querySelector("#prev-habit-week")?.addEventListener("click", () => changeSummaryWeek(-1));
    root.querySelector("#next-habit-week")?.addEventListener("click", () => changeSummaryWeek(1));
    root.querySelector("#empty-create-habit")?.addEventListener("click", () => openHabitModal());
    root.querySelector("#prev-habit-date")?.addEventListener("click", async () => changeSelectedDate(-1));
    root.querySelector("#next-habit-date")?.addEventListener("click", async () => changeSelectedDate(1));
    root.querySelector("#reset-habit-date")?.addEventListener("click", async () => resetSelectedDate());

    if (context.isReadOnly()) {
      clearSelection();
      return;
    }

    bindSelectionBar(root);

    root.querySelectorAll("[data-action='postpone']").forEach((element) => {
      element.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await handlePostponeHabit(element.dataset.id);
      });
    });

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
