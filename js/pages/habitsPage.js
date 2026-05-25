import habitsService from "../services/habitsService.js";
import habitLogsService from "../services/habitLogsService.js";
import { button } from "../components/button.js";
import { emptyState } from "../components/emptyState.js";
import { habitCard } from "../components/habitCard.js";
import { progressCard } from "../components/progressCard.js";
import { loadingState } from "../components/loadingState.js";
import { addDays, endOfDayISO, startOfDayISO, todayISO } from "../utils/dates.js";
import { calculateHabitStatus } from "../utils/streak.js";
import { validateRequired } from "../utils/validators.js";

const EMOJI_OPTIONS = ["✨", "📚", "💧", "🏃", "🧘", "🍎", "💻", "🌙"];

export function createHabitsPage(context) {
  const state = {
    habits: [],
    todayLogs: [],
    recentLogs: []
  };

  async function load() {
    state.habits = await habitsService.listHabits();
    state.todayLogs = await habitLogsService.listLogsByDate(todayISO());
    state.recentLogs = await habitLogsService.listLogsRange({
      startDate: startOfDayISO(addDays(new Date(), -14)),
      endDate: endOfDayISO(new Date())
    });
  }

  async function render(root) {
    context.setHeader({
      eyebrow: "",
      title: "Hábitos",
      subtitle: ""
    });

    root.innerHTML = loadingState("Montando sua rotina...");

    try {
      await load();
      root.innerHTML = getMarkup();
      bind(root);
    } catch (error) {
      context.toast.error(error.message || "Não foi possível carregar os hábitos.");
      root.innerHTML = emptyState({
        icon: "⚠️",
        title: "Falha ao carregar",
        description: "Confira a configuração do Supabase e tente novamente."
      });
    }
  }

  function getMarkup() {
    const completedIds = new Set(state.todayLogs.filter((log) => log.completed).map((log) => log.habit_id));
    const total = state.habits.length;
    const completed = completedIds.size;

    return `
      <div class="page-stack">
        ${progressCard({ completed, total })}
        <div class="section-row">
          <h2 class="section-title">Seus hábitos</h2>
          ${button("Adicionar hábito", "secondary", 'id="open-habit-modal" class="section-action"')}
        </div>
        ${
          state.habits.length
            ? `<section class="habit-list">${state.habits
                .map((habit) =>
                  habitCard({
                    habit,
                    isCompleted: completedIds.has(habit.id),
                    streakData: calculateHabitStatus(
                      state.recentLogs.filter((log) => log.habit_id === habit.id),
                      todayISO()
                    )
                  })
                )
                .join("")}</section>`
            : emptyState({
                icon: "🌿",
                title: "Nenhum hábito criado",
                description: "Adicione seu primeiro hábito para começar a acompanhar sua rotina.",
                action: button("Criar primeiro hábito", "primary", 'id="empty-create-habit"')
              })
        }
      </div>
    `;
  }

  function bind(root) {
    root.querySelector("#open-habit-modal")?.addEventListener("click", () => openHabitModal());
    root.querySelector("#empty-create-habit")?.addEventListener("click", () => openHabitModal());

    root.querySelectorAll("[data-action='toggle']").forEach((element) => {
      element.addEventListener("click", async () => {
        const habitId = element.dataset.id;
        const isCompleted = element.classList.contains("is-complete");
        try {
          if (isCompleted) {
            await habitLogsService.unmarkHabitComplete({ habitId, date: todayISO() });
            context.toast.success("Hábito desmarcado.");
          } else {
            await habitLogsService.markHabitComplete({ habitId, date: todayISO() });
            context.toast.success("Hábito concluído.");
          }
          await render(root);
        } catch (error) {
          context.toast.error(error.message || "Não foi possível atualizar o hábito.");
        }
      });
    });

    root.querySelectorAll("[data-action='edit']").forEach((element) => {
      element.addEventListener("click", () => {
        const habit = state.habits.find((item) => item.id === element.dataset.id);
        openHabitModal(habit);
      });
    });

    root.querySelectorAll("[data-action='delete']").forEach((element) => {
      element.addEventListener("click", async () => {
        const habit = state.habits.find((item) => item.id === element.dataset.id);
        openDeleteHabitModal(habit, root);
      });
    });
  }

  function openHabitModal(habit = null) {
    context.modal.open({
      title: habit ? "Editar hábito" : "Novo hábito",
      description: "Hábitos são diários e ficam sempre visíveis na sua rotina.",
      content: `
        <form class="form-stack" id="habit-form">
          <label>
            Título
            <input name="title" maxlength="80" value="${habit?.title ?? ""}" placeholder="Ex.: Ler 20 minutos" required />
          </label>
          <label>
            Descrição
            <textarea name="description" maxlength="180" placeholder="Opcional">${habit?.description ?? ""}</textarea>
          </label>
          <label>
            Ícone
            <select name="icon">
              ${EMOJI_OPTIONS.map((emoji) => `<option value="${emoji}" ${habit?.icon === emoji ? "selected" : ""}>${emoji}</option>`).join("")}
            </select>
          </label>
        </form>
      `,
      footer: `
        ${button("Cancelar", "ghost", 'type="button" data-close-modal')}
        ${button(habit ? "Salvar alterações" : "Salvar hábito", "primary", 'type="submit" form="habit-form"')}
      `
    });

    document.querySelector("#habit-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const payload = {
        title: String(formData.get("title")).trim(),
        description: String(formData.get("description")).trim(),
        icon: String(formData.get("icon")).trim()
      };

      const validation = validateRequired(payload.title, "Informe o nome do hábito.");
      if (validation) {
        context.toast.error(validation);
        return;
      }

      try {
        if (habit) {
          await habitsService.updateHabit(habit.id, payload);
          context.toast.success("Hábito atualizado.");
        } else {
          await habitsService.createHabit(payload);
          context.toast.success("Hábito criado.");
        }
        context.modal.close();
        await render(context.root);
      } catch (error) {
        context.toast.error(error.message || "Não foi possível salvar o hábito.");
      }
    });
  }

  function openDeleteHabitModal(habit, root) {
    context.modal.open({
      title: "Excluir hábito",
      description: `Deseja remover "${habit.title}" da sua rotina?`,
      content: "<p>O hábito será desativado e deixará de aparecer na lista.</p>",
      footer: `
        ${button("Cancelar", "ghost", 'type="button" data-close-modal')}
        ${button("Excluir", "danger", 'type="button" id="confirm-delete-habit"')}
      `
    });

    document.querySelector("#confirm-delete-habit").addEventListener("click", async () => {
      try {
        await habitsService.deleteHabit(habit.id);
        context.modal.close();
        context.toast.success("Hábito excluído.");
        await render(root);
      } catch (error) {
        context.toast.error(error.message || "Não foi possível excluir o hábito.");
      }
    });
  }

  return { render };
}
