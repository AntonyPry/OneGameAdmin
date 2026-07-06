# Motivation Rules

Date: 2026-07-04

Status: source of truth for the next stabilization slice.

## Goal

Update OneGameAdmin motivation logic so a club admin can understand the payout for the current shift: fixed shift pay, task completion bonus, penalties, and sales bonuses tied to one total shift plan.

The old model with per-minute salary rates and separate category plan gates is deprecated.

## Shift Pay

- Day shift base pay: `1000` rub.
- Night shift base pay: `1200` rub.
- All tasks completed bonus: `1200` rub.

The all-tasks bonus is paid only when the shift has no failed motivation checks and all required tasks are completed.

## Penalties

| Rule | Penalty |
| --- | ---: |
| Long response to a message | `-300` rub per case |
| 3 unanswered/long-response messages | `-1200` rub total for this rule |
| Club not cleaned, up to 5 unclean places | `-600` rub |
| Club not cleaned, more than 5 unclean places | `-1200` rub |
| Mess/dirt in kitchen | `-1200` rub |
| Missed phone call without callback | `-300` rub per case |
| Mess at workplace | `-400` rub |
| Unauthorized people behind the desk | `-500` rub |
| Climate control issue | `-200` rub |
| Refrigerators not filled | `-300` rub |
| Loud swearing | `-100` rub per case |
| Secret guest failed | `-1200` rub |

Secret guest failure includes any of:

- no club tour;
- promotions were not explained;
- script was not followed;
- no attempt to offer a more expensive zone;
- no attempt to offer food/drinks or add-on services.

Friendly light communication with regular guests is acceptable, but it should not be loud enough to be heard at the club entrance.

## Sales Bonuses

Base rates:

- Bar: `5%`.
- Services: `10%`.

When the total shift plan is completed:

- Bar: `10%`.
- Services: `20%`.

The plan is a single total shift plan. The admin can complete the plan through any mix of bar, PC/tariffs, PS, and services sales. Category-specific plan gates should not block bar/service bonuses when the total plan is completed.

## Revenue Categories

Backend stats must separate at least:

- `barRevenue`: goods/bar sales;
- `servicesRevenue`: services such as rent, extra PS5 person, corkage fee, massage session;
- `psRevenue`: PS sessions/products if they are not services;
- `pcRevenue`: PC/tariff revenue;
- `totalRevenue`: all relevant shift revenue.

Current code combines `PS` and `SERVICE` into `psServiceRevenue`; this must be split before the new bonus calculation is reliable.

## Club Settings Contract

Recommended settings shape inside `Club.settings`:

```json
{
  "motivation": {
    "basePay": {
      "day": 1000,
      "night": 1200
    },
    "taskCompletionBonus": 1200,
    "penalties": {
      "longMessageResponse": {
        "perCase": 300,
        "escalationCount": 3,
        "escalationPenalty": 1200
      },
      "uncleanClub": {
        "basePenalty": 600,
        "thresholdPlaces": 5,
        "escalationPenalty": 1200
      },
      "dirtyKitchen": 1200,
      "missedCallNoCallback": 300,
      "messyWorkspace": 400,
      "strangersBehindDesk": 500,
      "climateControl": 200,
      "fridgeNotFilled": 300,
      "loudSwearingPerCase": 100,
      "secretGuestFailed": 1200
    },
    "bonusRates": {
      "bar": 0.05,
      "services": 0.1,
      "planMultiplier": 2
    }
  }
}
```

Keep legacy `salaryRates`, `bonusRates`, and `responsibilities` normalization during migration only for backward compatibility.

## Shift Check Payload

The current boolean checklist is not enough. The confirmation payload should support booleans and numeric counters:

```json
{
  "allTasksCompleted": true,
  "longMessageResponseCount": 0,
  "uncleanClubPlacesCount": 0,
  "dirtyKitchen": false,
  "missedCallNoCallbackCount": 0,
  "messyWorkspace": false,
  "strangersBehindDesk": false,
  "climateControlIssue": false,
  "fridgeNotFilled": false,
  "loudSwearingCount": 0,
  "secretGuestFailed": false,
  "secretGuestFailureReasons": {
    "noTour": false,
    "promotionsNotExplained": false,
    "scriptNotFollowed": false,
    "noUpsellAttempt": false,
    "noFoodDrinkOrServiceOffer": false
  }
}
```

Backend should calculate penalties from this payload and store both the raw check and the calculated breakdown.

## Calculation Rules

1. Determine shift type: `day` or `night`.
2. Start with fixed base pay: `1000` for day, `1200` for night.
3. Add `1200` all-tasks bonus only if all tasks are completed and no motivation penalty is triggered.
4. Calculate total plan completion from `totalRevenue >= plan.totalRevenue`.
5. Calculate bar bonus from actual `barRevenue`.
6. Calculate services bonus from actual `servicesRevenue`.
7. If total plan is completed, multiply bar and services rates by `2`.
8. Subtract all penalties.
9. Return a detailed payout breakdown for the frontend.

Recommended backend response fields:

- `baseSalary`;
- `taskCompletionBonus`;
- `penaltiesTotal`;
- `penaltiesBreakdown`;
- `barBonus`;
- `servicesBonus`;
- `planMultiplierApplied`;
- `totalAward`;
- `payoutBreakdown.motivationRulesVersion`.

## Feature Prompt: Motivation Rules Update

```md
Прочитай `AGENTS.md`, `docs/CODEX_WORKFLOW.md`, `docs/SPRINT_STATUS.md`, `docs/SAAS_STABILIZATION_PLAN.md`, `docs/MOTIVATION_RULES.md`.

Работай в текущем проекте `/Users/antonypry/Documents/OneGameAdmin`, ветка `dev`.

Feature:
Перевести расчет мотивации на новые правила от 2026-07-04.

Цель:
Администратор клуба должен видеть выплату за смену по новой модели: фиксированная дневная/ночная оплата, бонус за выполнение всех задач, штрафы, проценты с бара/услуг и x2 процентов при выполнении общего плана.

Scope backend:
- Расширить `Club.settings` через `motivation` из `docs/MOTIVATION_RULES.md`.
- Оставить backward compatibility для старых `salaryRates`, `bonusRates`, `responsibilities` только как legacy fallback.
- Исправить расчет в `server/services/admin.service.js`:
  - фиксированная база `1000/1200`, а не ставка за минуту;
  - `+1200` за выполнение всех задач;
  - штрафы по числовым и boolean-полям;
  - общий план как единственный gate для x2;
  - bar/services bonuses по фактической выручке.
- Разделить `SERVICE` и `PS` в текущей статистике: сервисы не должны смешиваться с PS.
- Обновить сохранение проверки смены: payload должен принимать counters и booleans, а не только boolean checklist.
- Вернуть детальный `payoutBreakdown`, чтобы frontend мог объяснить каждую сумму.
- Обновить seed/default settings.

Scope frontend:
- Обновить `ClubSettingsForm` под `motivation` settings.
- Обновить admin panel:
  - показать фиксированную базу смены;
  - показать бонус за все задачи;
  - показать штрафы и итог;
  - заменить старый boolean checklist на форму с counters/booleans;
  - показать бар/услуги и x2 при выполнении общего плана.
- Сохранить роль-based confirmation: подтверждать проверку могут manager/owner/platform_admin.

Out of scope:
- Не добавлять billing/subscriptions.
- Не менять auth/RBAC за пределами доступа к уже существующим endpoint'ам.
- Не хранить реальные секреты.

Acceptance criteria:
- Для дневной смены база `1000`, для ночной `1200`.
- При отсутствии нарушений и выполнении задач добавляется `1200`.
- 3 долгих/неотвеченных сообщения дают `-1200` по этому правилу.
- Неприбранный клуб до 5 мест дает `-600`, больше 5 мест `-1200`.
- Громкий мат считается `-100` за каждый случай.
- Тайный гость с любой проваленной причиной дает `-1200`.
- Бар начисляется `5%`, услуги `10%`.
- При выполнении общего плана бар становится `10%`, услуги `20%`.
- Выполнение общего плана считается по total shift plan, а не по отдельным категориям.
- UI на desktop и mobile 390px не имеет горизонтального overflow.

Checks required:
- `git status --short --branch`
- backend syntax checks for changed files
- relevant unit/domain smoke checks for calculation examples
- client build
- browser QA desktop and mobile 390px:
  - admin panel payout;
  - confirmation form with counters;
  - no penalties scenario;
  - penalties scenario;
  - total plan not met vs met;
  - console/network errors.

At the end return feature handoff per `docs/CODEX_WORKFLOW.md`.
```

## QA Prompt: Motivation Rules

```md
Прочитай `AGENTS.md`, `docs/CODEX_WORKFLOW.md`, `docs/MOTIVATION_RULES.md` и feature handoff по обновлению мотивации.

Проверь новую мотивацию как release QA. Не начинай с исправлений.

Check:
- diff against the previous feature baseline;
- `Club.settings.motivation` defaults and seed data;
- backward compatibility with legacy settings where expected;
- calculation examples for day/night base pay;
- all penalties from `docs/MOTIVATION_RULES.md`;
- 3 long/unanswered messages = `-1200`;
- unclean club threshold: `1..5 = -600`, `>5 = -1200`;
- secret guest failure reasons;
- bar/services rates and x2 after total plan completion;
- `SERVICE` is not merged into `PS`;
- payout breakdown explains every amount;
- frontend confirmation form accepts counters and booleans;
- role access for confirmation;
- desktop and mobile 390px browser QA;
- console/network errors;
- horizontal overflow.

Return findings by severity, verified checks, not verified, release status, and exact fix prompts if needed.
```

## Clarifications To Confirm

- The rule "3 messages without answer/long response = -1200" is treated as an escalation total for this rule, not `3 * -300 = -900`.
- The club cleanliness rule is treated as `1..5` unclean places = `-600`, more than `5` = `-1200`.
- Secret guest failure is treated as one `-1200` penalty if any listed script/tour/promotion/upsell requirement fails.
