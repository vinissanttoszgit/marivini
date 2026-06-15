# Notificações push

## Variáveis de ambiente das Edge Functions

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`

## Helpers compartilhados

- `supabase/functions/_shared/supabaseAdmin.ts`
- `supabase/functions/_shared/push.ts`
- `supabase/functions/_shared/responses.ts`

## Functions criadas

- `send-test-push`
  - uso: chamada pelo frontend autenticado
  - objetivo: enviar push real para usuário logado
- `send-daily-habit-reminders`
  - uso: chamada por cron
  - objetivo: avisar hábitos do dia ainda incompletos
- `send-calendar-reminders`
  - uso: chamada por cron
  - objetivo: avisar eventos com `reminder_minutes`
- `notify-shared-habit-completed`
  - uso: chamada pelo frontend autenticado
  - objetivo: avisar viewers quando dono da conta conclui hábito

## Chamadas feitas pelo frontend

- `send-test-push`
  - botão: `Enviar teste real pelo servidor`
- `notify-shared-habit-completed`
  - ponto: após conclusão bem-sucedida de hábito
  - comportamento: silencioso em caso de falha

## Functions para cron

- `send-daily-habit-reminders`
  - header obrigatório: `x-cron-secret`
  - sugestão: todos os dias às 09:00 no fuso de Brasília
- `send-calendar-reminders`
  - header obrigatório: `x-cron-secret`
  - sugestão: a cada 1 ou 5 minutos

## Observações

- `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` ficam só nas Edge Functions.
- `VAPID_PUBLIC_KEY` continua no frontend para criar subscription.
- `notification_deliveries` precisa existir com suporte a `dedupe_key`, `status`, `notification_type`, `user_id`, `title`, `body`, `url`, `tag`, `error_message`, `metadata` e `sent_at`.
