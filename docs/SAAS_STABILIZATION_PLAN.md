# SaaS Stabilization Plan

Date: 2026-07-02

## Product Direction

OneGameAdmin should become a stable SaaS-style application for multiple computer clubs.

Main user value:

- shift admins see current shift stats, salary, bonuses, and what each earning component comes from;
- managers/owners manage plans, reports, checklist confirmation, and club-level settings;
- platform admins manage which clubs exist, which users have access, and how each club is configured.
- motivation rules are configurable per club and currently follow `docs/MOTIVATION_RULES.md`.

## Current State Summary

The current `dev` branch contains an uncommitted SaaS transition on top of `main`.

Backend already has:

- Sequelize/MySQL setup;
- `Users`, `Clubs`, `UserClubs`, `MonthlyPlans`, `ShiftResponsibilities`;
- JWT login;
- `authenticateToken`;
- `checkClubAccess`;
- per-club Smartshell token cache;
- split `admin.service`, `payments.service`, `excel.service`;
- plans API.

Frontend already has:

- Vite entrypoint;
- Tailwind/shadcn-style components;
- `api` axios client with `Authorization` and `X-Club-ID`;
- new `LoginPage`;
- `ProtectedRoute`;
- `Layout`;
- `PlansPage`;
- redesigned admin/export screens.

Important unstable areas:

- `Club.id` and `Club.smartshell_id` are mixed.
- Club settings storage and reading do not match.
- Auth state is split between old and new approaches.
- Role model is not explicit enough for SaaS administration.
- Club/settings/user administration does not exist.
- Public registration and bootstrap data are not production-safe.
- Some old password flows remain in UI.
- Motivation logic still uses the old per-minute salary and boolean checklist model; the current rules are defined in `docs/MOTIVATION_RULES.md`.

## Target Role Model

Use explicit roles and avoid ambiguity around the word `admin`.

Recommended model:

- `platform_admin`: SaaS/system administrator. Can manage all clubs, all users, memberships, and global support tasks.
- `owner`: club owner. Can manage own club settings, users for own club, plans, exports, reports, and admin panel.
- `manager`: club manager. Can manage plans, exports, reports, and confirm shift responsibilities for own club.
- `club_admin`: shift administrator/operator. Can use the shift admin panel and see payouts/bonuses for own club.

Implementation note:

- Current DB has `UserClub.role` with `owner`, `manager`, `admin`.
- For a stabilizing slice, either migrate `admin` to `club_admin`, or keep DB value `admin` temporarily and expose it in code through a central role map. Do not leave role strings scattered across client/server.
- Add a platform-level user role such as `Users.system_role = 'platform_admin' | 'user'`, or an equivalent explicit mechanism. Platform admins should not depend on membership in every club.

## Club Settings Contract

Use `Club.settings` as the source of truth for configurable club behavior.

Recommended shape:

```json
{
  "motivation": {
    "basePay": {
      "day": 1000,
      "night": 1200
    },
    "taskCompletionBonus": 1200,
    "bonusRates": {
      "bar": 0.05,
      "services": 0.1,
      "planMultiplier": 2
    }
  },
  "responsibilities": {
    "items": [
      { "key": "allTasksCompleted", "label": "Все задачи выполнены", "enabled": true }
    ]
  },
  "smartshell": {
    "companyId": 6816
  }
}
```

Full motivation settings, penalties, and calculation rules are defined in `docs/MOTIVATION_RULES.md`.
Legacy `salaryRates` and `bonusRates` may be normalized during migration, but new code should write the `motivation` section.

Secrets policy:

- Do not store real Smartshell login/password in repository docs or code.
- Current secure storage decision: Smartshell company id, manager login, and
  manager password are configured per club in the club settings UI.
- Only the credentials encryption key belongs in backend env. Do not put
  Smartshell manager login/password into env, `CURRENT_CLUB_SETTINGS_JSON`,
  docs, logs, or commits.

## Feature Prompt 1: Backend Tenant And Settings Foundation

```md
Прочитай `AGENTS.md`, `docs/CODEX_WORKFLOW.md`, `docs/SPRINT_STATUS.md`, `docs/SAAS_STABILIZATION_PLAN.md`.

Работай в текущем проекте `/Users/antonypry/Documents/OneGameAdmin`, ветка `dev`.

Feature:
Стабилизировать backend tenant/settings foundation.

Цель:
Убрать путаницу между `Club.id` в нашей БД и `Club.smartshell_id` / Smartshell company id, а также привести чтение настроек клуба к единому источнику `Club.settings`.

Scope:
- Ввести явные имена и контракт: `dbClubId` для нашей БД, `smartshellCompanyId` для Smartshell.
- Исправить `server/controllers/admin.controller.js` и `server/services/admin.service.js`, чтобы:
  - `MonthlyPlan` и `ShiftResponsibility` всегда использовали `Club.id`;
  - Smartshell-запросы и token service всегда использовали `Club.smartshell_id` или `settings.smartshell.companyId`, если будет выбран этот контракт;
  - `calculateCurrentStats` не принимал двусмысленный `clubId`.
- Добавить helper для нормализации `Club.settings` с безопасными defaults:
  - motivation settings from `docs/MOTIVATION_RULES.md`;
  - legacy salary/bonus settings as temporary fallback only;
  - responsibilities/checklist config;
  - smartshell company id.
- Исправить расчет выплат, чтобы он читал settings из `Club.settings`, а не несуществующие поля `club.salary_rates` / `club.bonuses`.
- Привести seed/migration к выбранному settings shape.
- Добавить/исправить уникальные ограничения, если это уместно:
  - monthly plan uniqueness by `club_id + date + shift_type`;
  - shift responsibility uniqueness by `club_id + shift_created_at`.
- Убрать или явно пометить как deprecated `server/configs/club.config.js`, если он больше не используется.

Out of scope:
- Не строить UI управления клубами.
- Не менять визуальный дизайн.
- Не делать полную систему пользователей/ролей, кроме минимальных поправок, необходимых для settings foundation.
- Не добавлять реальные секреты.

Existing functionality to inspect:
- `server/models/club.js`
- `server/models/monthlyPlan.js`
- `server/models/shiftResponsibility.js`
- `server/migrations/20260404095244-init-database.js`
- `server/seeders/20260404095704-demo-club.js`
- `server/controllers/admin.controller.js`
- `server/services/admin.service.js`
- `server/services/token.service.js`
- `server/services/payments.service.js`
- `server/middlewares/club.middleware.js`

Acceptance criteria:
- По коду понятно, где используется ID клуба в нашей БД, а где Smartshell company id.
- Текущая статистика, планы и чек-листы не могут случайно искать записи по Smartshell id вместо DB id.
- Расчет выплат использует `Club.settings` и defaults.
- Seed создает клуб с settings в актуальном shape.
- В коде не появляется новых hardcoded secrets.
- `npm run build` в `client` не ломается из-за backend changes.
- `node --check` проходит для измененных backend-файлов.

Checks required:
- `git status --short --branch`
- `node --check` для измененных backend-файлов
- если доступна БД: migration/seed smoke
- `npm run build -- --outDir /private/tmp/onegame-admin-client-dist` из `client`

At the end return feature handoff per `docs/CODEX_WORKFLOW.md`.
```

## Feature Prompt 2: Backend Auth And RBAC Hardening

```md
Прочитай `AGENTS.md`, `docs/CODEX_WORKFLOW.md`, `docs/SPRINT_STATUS.md`, `docs/SAAS_STABILIZATION_PLAN.md`.

Работай после завершения Feature 1.

Feature:
Стабилизировать backend auth и ролевую модель.

Цель:
Сделать нормальный вход и предсказуемую RBAC-систему для SaaS: platform admin, owner, manager, club admin.

Scope:
- Ввести центральное описание ролей и permissions на backend.
- Добавить platform-level role/mechanism для SaaS-админа:
  - например `Users.system_role = 'platform_admin' | 'user'`;
  - или другое явное решение, но не через membership во всех клубах.
- Закрыть или ограничить публичный `/api/auth/register`.
- Добавить безопасный bootstrap/dev seed для первого пользователя без записи реальных паролей в код:
  - использовать env vars для email/password;
  - не печатать пароль в логах.
- Добавить `/api/auth/me`, который возвращает:
  - user profile;
  - system role;
  - club memberships;
  - current role per club.
- Добавить middleware/helpers:
  - `requireSystemRole(...)`;
  - `requireClubRole(...)`;
  - единый способ разрешать platform admin доступ.
- Применить роли к существующим backend routes:
  - shift/admin panel data: `club_admin`, `manager`, `owner`, `platform_admin`;
  - plans read/write: `manager`, `owner`, `platform_admin`;
  - exports: `manager`, `owner`, `platform_admin`;
  - responsibility confirmation: `manager`, `owner`, `platform_admin`.
- Проверить, что `checkClubAccess` корректно ведет себя:
  - с обычным пользователем;
  - с platform admin;
  - при отсутствующем или неверном `X-Club-ID`.

Out of scope:
- Не строить frontend settings UI.
- Не делать invitation emails.
- Не реализовывать password reset.
- Не хранить real credentials в docs/code.

Existing functionality to inspect:
- `server/controllers/auth.controller.js`
- `server/routes/auth.routes.js`
- `server/middlewares/auth.middleware.js`
- `server/middlewares/club.middleware.js`
- `server/routes/admin.routes.js`
- `server/routes/payments.routes.js`
- `server/models/user.js`
- `server/models/userclub.js`
- `server/models/club.js`
- migrations/seeders

Acceptance criteria:
- Роли и permissions заданы централизованно.
- Public register больше не является дырой для произвольного создания пользователей.
- Есть рабочий auth/me endpoint для клиента.
- Backend endpoints возвращают 401/403/400 предсказуемо.
- Existing admin/plans/payments routes не доступны пользователям без нужной роли.
- Platform admin может выполнять SaaS-админские действия без membership в каждом клубе.

Checks required:
- `git status --short --branch`
- `node --check` для измененных backend-файлов
- API smoke через curl/fetch, если доступен сервер и тестовый пользователь
- negative checks: no token, wrong token, wrong role, wrong club
- `npm run build -- --outDir /private/tmp/onegame-admin-client-dist` из `client`

At the end return feature handoff per `docs/CODEX_WORKFLOW.md`, including a role matrix.
```

## Feature Prompt 3: Backend Club, Settings, And User Administration API

```md
Прочитай `AGENTS.md`, `docs/CODEX_WORKFLOW.md`, `docs/SPRINT_STATUS.md`, `docs/SAAS_STABILIZATION_PLAN.md`.

Работай после Feature 1 и Feature 2.

Feature:
Добавить backend API для управления клубами, настройками и пользователями.

Цель:
Чтобы SaaS/platform admin отвечал за то, какие клубы существуют, какие у них настройки и кто имеет доступ.

Scope:
- Добавить API для platform admin:
  - list clubs;
  - get club by id;
  - create club;
  - update club basic fields: name, address, opening_date, smartshell company id/settings;
  - update club salary/bonus/checklist settings;
  - list users;
  - create/update user without exposing password hash;
  - assign/update/remove user membership in club with role.
- Добавить owner-level API for own club if useful:
  - read own club settings;
  - update non-sensitive club settings for own club.
- Validate payloads manually or through existing lightweight patterns. Do not add a new validation framework unless clearly worth it.
- Never return password hashes or secrets.
- Keep Smartshell credentials out of this slice unless there is already a secure storage decision.
- Add routes in a clear namespace, for example:
  - `/api/platform/clubs`
  - `/api/platform/users`
  - `/api/clubs/current/settings`

Out of scope:
- No frontend UI.
- No billing/subscriptions.
- No email invitations.
- No audit log unless tiny and natural.

Existing functionality to inspect:
- all auth/RBAC changes from Feature 2;
- `server/models/*`;
- `server/routes/index.js`;
- `server/controllers/*`;
- `server/services/*`.

Acceptance criteria:
- Platform admin can manage clubs and memberships through API.
- Owners/managers cannot manage clubs outside their permissions.
- Club settings update preserves existing unknown settings where appropriate or intentionally replaces documented sections.
- API responses are shaped for frontend use and omit sensitive fields.
- Errors are clear and consistent.

Checks required:
- `git status --short --branch`
- `node --check` for changed backend files
- API smoke for:
  - platform admin list/create/update club;
  - platform admin assign role;
  - non-platform user denied platform endpoints;
  - owner/manager own-club settings access according to chosen rules.

At the end return feature handoff per `docs/CODEX_WORKFLOW.md`, including endpoint list and role matrix.
```

## Feature Prompt 4: Frontend Auth, Active Club, And Role-Aware Routing

```md
Прочитай `AGENTS.md`, `docs/CODEX_WORKFLOW.md`, `docs/SPRINT_STATUS.md`, `docs/SAAS_STABILIZATION_PLAN.md`.

Работай после backend Features 1-2, ideally after `/api/auth/me` exists.

Feature:
Стабилизировать клиентский auth, active club и role-aware routing.

Цель:
Убрать split между старым `sessionStorage` и новым JWT/localStorage, сделать понятный вход, выбор активного клуба и навигацию по ролям.

Scope:
- Ввести единый frontend auth/session helper:
  - access token;
  - user profile;
  - memberships;
  - activeClubId;
  - activeClubRole;
  - systemRole.
- Перевести `App.jsx`, `ProtectedRoute.jsx`, `Layout.jsx`, `HomePage.jsx`, `LoginPage.jsx`, `api.js` на один контракт.
- Убрать зависимость от `sessionStorage`.
- Добавить `/api/auth/me` refresh после загрузки приложения.
- Если у пользователя несколько клубов, добавить выбор активного клуба в layout.
- Если у пользователя нет клубов и он не platform admin, показать понятное состояние.
- Role-aware navigation:
  - platform admin: clubs/users/settings admin screens, when implemented;
  - owner/manager: plans, exports, admin panel, settings as allowed;
  - club_admin: admin panel only.
- Исправить root redirect:
  - platform admin -> club/admin management page;
  - owner/manager -> export or plans;
  - club_admin -> admin panel;
  - unauthenticated -> login.
- Ensure axios `baseURL` usage is not duplicated. Do not concatenate `import.meta.env.VITE_BACKEND_URL` when using the configured `api` instance unless there is a clear reason.

Out of scope:
- Do not build full club/settings UI in this slice.
- Do not redesign all pages.
- Do not change backend permissions except tiny compatibility fixes.

Existing functionality to inspect:
- `client/src/api.js`
- `client/src/App.jsx`
- `client/src/components/ProtectedRoute.jsx`
- `client/src/components/Layout.jsx`
- `client/src/pages/LoginPage/LoginPage.jsx`
- `client/src/pages/HomePage/HomePage.jsx`
- `client/src/pages/AdminPage/AdminPage.jsx`
- `client/src/pages/PlansPage/PlansPage.jsx`
- `client/src/pages/ExportStatisticsPage/ExportStatisticsPage.jsx`

Acceptance criteria:
- No auth/routing code reads `sessionStorage`.
- Login, logout, refresh, 401/403 redirect are consistent.
- Active club id is included in protected API requests.
- UI does not show navigation items that the current role cannot use.
- Direct navigation to protected routes works correctly for each role.
- Client build passes.

Checks required:
- `git status --short --branch`
- `npm run build -- --outDir /private/tmp/onegame-admin-client-dist`
- Browser QA if server is runnable:
  - desktop;
  - mobile 390px;
  - login/logout;
  - direct route access for owner/manager/club_admin/platform_admin;
  - no horizontal overflow;
  - console/network errors checked.

At the end return feature handoff per `docs/CODEX_WORKFLOW.md`, including screenshots if browser QA is possible.
```

## Feature Prompt 5: Frontend Club, Settings, And User Administration

```md
Прочитай `AGENTS.md`, `docs/CODEX_WORKFLOW.md`, `docs/SPRINT_STATUS.md`, `docs/SAAS_STABILIZATION_PLAN.md`.

Работай после Feature 3 and Feature 4.

Feature:
Добавить frontend для управления клубами, настройками и пользователями.

Цель:
Platform admin should manage what clubs exist, their settings, and user access. Owners/managers should see or edit allowed own-club settings according to backend permissions.

Scope:
- Add admin/settings navigation based on roles.
- Build screens using the existing shadcn/Tailwind component style:
  - clubs list;
  - club create/edit;
  - club settings form;
  - users list;
  - user create/edit basic fields;
  - membership/role assignment.
- Settings form sections:
  - basic club info;
  - Smartshell company id only, no secret passwords unless backend has secure storage;
  - motivation settings from `docs/MOTIVATION_RULES.md`;
  - responsibility/check payload labels and enabled state.
- Add loading/error/empty states.
- Keep forms compact and operational, not landing-page style.
- Avoid visible instructional text that describes app features unnecessarily.

Out of scope:
- No billing/subscription UI.
- No email invitation flow.
- No password reset.
- No fancy redesign of existing admin panel.

Existing functionality to inspect:
- frontend auth/session from Feature 4;
- backend endpoints from Feature 3;
- `client/src/components/ui/*`;
- `client/src/components/Layout.jsx`;
- `client/src/pages/PlansPage/PlansPage.jsx` for table/form style.

Acceptance criteria:
- Platform admin can create/update clubs and memberships from UI.
- Unauthorized roles do not see admin management screens and cannot access them by URL.
- Settings updates persist and are reflected after reload.
- Forms validate required fields and show server errors.
- No secrets are displayed or stored in client state beyond normal form inputs.

Checks required:
- `git status --short --branch`
- `npm run build -- --outDir /private/tmp/onegame-admin-client-dist`
- Browser QA desktop and mobile 390px:
  - clubs list;
  - create/edit club;
  - settings edit;
  - users/memberships;
  - role visibility;
  - console/network errors;
  - horizontal overflow.

At the end return feature handoff per `docs/CODEX_WORKFLOW.md`, with screenshots if possible.
```

## Feature Prompt 6: Motivation Rules Update

```md
Прочитай `AGENTS.md`, `docs/CODEX_WORKFLOW.md`, `docs/SPRINT_STATUS.md`, `docs/SAAS_STABILIZATION_PLAN.md`, `docs/MOTIVATION_RULES.md`.

Работай после Features 1-5 или после того, как backend/client settings foundation уже стабилизированы.

Feature:
Перевести расчет мотивации на новые правила от 2026-07-04.

Цель:
Администратор клуба должен видеть выплату за смену по новой модели: фиксированная дневная/ночная оплата, бонус за выполнение всех задач, штрафы, проценты с бара/услуг и x2 процентов при выполнении общего плана.

Используй полный контракт, расчетные правила, acceptance criteria и QA prompt из `docs/MOTIVATION_RULES.md`.

Scope:
- Расширить `Club.settings` через `motivation`.
- Оставить legacy normalization для старых `salaryRates`, `bonusRates`, `responsibilities` только как fallback.
- Исправить backend расчет выплат и `payoutBreakdown`.
- Разделить `SERVICE` и `PS` в текущей статистике.
- Обновить payload проверки смены: counters/booleans вместо только boolean checklist.
- Обновить seed/default settings.
- Обновить `ClubSettingsForm`, admin panel и confirmation modal.

Acceptance criteria:
- Новые правила из `docs/MOTIVATION_RULES.md` проходят на расчетных примерах.
- UI объясняет каждую сумму: база, бонус за задачи, штрафы, бар, услуги, x2 при общем плане.
- Role-based confirmation сохраняется.
- Desktop/mobile QA не показывает горизонтальный overflow.

Checks required:
- `git status --short --branch`
- backend syntax checks for changed files
- domain smoke checks for calculation examples
- client build
- browser QA desktop and mobile 390px

At the end return feature handoff per `docs/CODEX_WORKFLOW.md`.
```

## Feature Prompt 7: Product Screen Stabilization

```md
Прочитай `AGENTS.md`, `docs/CODEX_WORKFLOW.md`, `docs/SPRINT_STATUS.md`, `docs/SAAS_STABILIZATION_PLAN.md`.

Работай после Features 1-6.

Feature:
Стабилизировать основные пользовательские экраны: admin panel, plans, exports.

Цель:
Сделать текущие рабочие экраны устойчивыми после SaaS/auth/settings перехода.

Scope:
- Admin panel:
  - uses unified API client;
  - uses active club;
  - handles no active shift;
  - handles no plan;
  - handles Smartshell/token errors;
  - shows payout breakdown from backend settings and `docs/MOTIVATION_RULES.md`;
  - removes manager password input if backend now uses role-based confirmation;
  - only allowed roles can confirm checklist.
- Plans page:
  - owner/manager/platform admin access only;
  - active club aware;
  - clear loading/error/empty states;
  - save flow works after auth changes.
- Export page:
  - owner/manager/platform admin access only;
  - active club aware;
  - downloads use the unified `api` baseURL correctly.
- Remove or modernize obsolete `HomePage` route if it is no longer used.
- Make text fit on mobile 390px and avoid horizontal overflow.

Out of scope:
- No new club management features.
- No redesign beyond stabilization.
- No new payout business rules beyond `docs/MOTIVATION_RULES.md`.

Existing functionality to inspect:
- `client/src/pages/AdminPage/*`
- `client/src/pages/PlansPage/PlansPage.jsx`
- `client/src/pages/ExportStatisticsPage/ExportStatisticsPage.jsx`
- backend admin/payments routes and services

Acceptance criteria:
- Existing user workflows work with the stabilized auth and role model.
- The manager password modal is removed or converted to a role-based confirmation UX.
- API errors do not leave screens stuck in permanent loading.
- Mobile 390px is usable.
- Build passes.

Checks required:
- `git status --short --branch`
- `npm run build -- --outDir /private/tmp/onegame-admin-client-dist`
- Backend `node --check` if backend touched
- Browser QA desktop/mobile 390px:
  - login as each role;
  - admin panel;
  - checklist confirmation allowed/denied;
  - plans read/save;
  - exports with mocked or real backend response where possible;
  - console/network errors;
  - horizontal overflow.

At the end return feature handoff per `docs/CODEX_WORKFLOW.md`, with screenshots if possible.
```

## QA Prompt: SaaS Stabilization Release Review

```md
Прочитай `AGENTS.md`, `docs/CODEX_WORKFLOW.md`, `docs/SPRINT_STATUS.md`, `docs/SAAS_STABILIZATION_PLAN.md`.

Review this stabilization release. Do not start by implementing fixes.

Original goal:
Turn the current uncommitted SaaS transition on `dev` into a stable multi-club foundation for OneGameAdmin.

Feature handoffs to read:
- Feature 1: Backend tenant/settings foundation
- Feature 2: Backend auth/RBAC hardening
- Feature 3: Backend club/settings/user administration API
- Feature 4: Frontend auth/active club/routing
- Feature 5: Frontend club/settings/user administration
- Feature 6: Motivation rules update
- Feature 7: Product screen stabilization

Please check:
- diff against `main`;
- current `git status --short --branch`;
- no accidental `.DS_Store`, node_modules, secrets, or unrelated artifacts staged;
- migrations and seed data;
- DB id vs Smartshell id correctness;
- `Club.settings` read/write contract;
- motivation rules from `docs/MOTIVATION_RULES.md`;
- fixed day/night base pay, task bonus, penalties, bar/services bonuses, and x2 when total plan is met;
- separation of bar, services, PS, PC, and total revenue where needed for payout calculation;
- auth and role matrix;
- platform admin, owner, manager, club_admin flows;
- route protection on backend and frontend;
- client build;
- backend syntax/checks;
- browser QA desktop;
- browser QA mobile 390px;
- console/network errors;
- horizontal overflow;
- admin panel, plans, exports, club settings, users/memberships;
- docs/user-guidance impact.

Expected role matrix:
- platform_admin: manage all clubs/users/settings, access reports/plans/admin screens as support.
- owner: manage own club settings/users/plans/exports/admin panel.
- manager: plans/exports/admin panel/checklist confirmation for own club.
- club_admin: shift admin panel and payout view for own club.

Return:
- findings by severity;
- verified checks;
- not verified;
- release status: blocked / needs fixes / ready for merge / ready for deploy;
- exact fix prompts for feature chats if issues are found.
```
