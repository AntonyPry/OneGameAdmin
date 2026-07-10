# Smartshell API Capabilities

Дата: 2026-07-10

Статус: срез 2, live/API-first направление. На этом этапе OneGameAdmin не
строит новый local revenue sync и не переводит продукт на локальное хранение
фактов. Smartshell API рассматривается как основной источник live-данных.

Endpoint:

```text
https://billing.smartshell.gg/api/graphql
```

## Цель Среза

Понять, что реально доступно в Smartshell GraphQL schema, и на этой основе
спланировать ближайшие продуктовые срезы без гадания.

Итоговая архитектурная линия для ближайших работ:

```text
Smartshell API -> backend adapter/normalizer -> расчеты/API -> UI
```

Не делаем в ближайших срезах:

```text
Smartshell API -> local revenue DB -> расчеты/API -> UI
```

## Как Проверяли

Выполнен GraphQL introspection без bearer token.

Результат:

- introspection доступна;
- schema содержит `545` типов;
- root `Query` содержит `185` полей;
- root `Mutation` содержит `219` полей;
- обычный data-query без token возвращает `not permitted` с code `401`, то
  есть реальные данные требуют авторизации.

Сохраненные артефакты:

- `outputs/smartshell-api-audit/introspection-response.json`;
- `outputs/smartshell-api-audit/schema-summary.json`;
- `outputs/smartshell-api-audit/query-operations.json`;
- `outputs/smartshell-api-audit/mutation-operations.json`;
- `outputs/smartshell-api-audit/grouped-operations.json`;
- `outputs/smartshell-api-audit/object-types.json`;
- `outputs/smartshell-api-audit/input-types.json`;
- `outputs/smartshell-api-audit/enum-types.json`;
- `outputs/smartshell-api-audit/query-operations.md`;
- `outputs/smartshell-api-audit/mutation-operations.md`.

Артефакты содержат schema metadata, names/types/descriptions. Они не должны
содержать bearer token, manager login/password или реальные данные клиентов.

## Уже Используется В Проекте

Текущий backend уже использует Smartshell GraphQL для:

- `activeWorkShift` в `server/services/admin.service.js`;
- `eventList` в `server/services/payments.service.js`;
- `workShifts` в `server/services/payments.service.js`;
- manager token через `login(input: { login, password, company_id })` в
  `server/services/token.service.js`.

Текущие event types в коде:

- `PAYMENT_CREATED`;
- `DEPOSIT_ADDED_ONLINE`;
- `CLIENT_SESSION_FINISHED`;
- `BONUS_PAYMENT_CREATED`;
- `PAYMENT_REFUND`;
- `CASH_ORDER_CREATED`.

## Области API

### Смены И Деньги Смены

Полезные queries:

- `activeWorkShift`;
- `workShift(id)`;
- `workShifts(input, page, first)`;
- `finishedWorkShifts(input)`;
- `workShiftsReport(input)`;
- `workShiftsSummaryReport(input)`;
- `workShiftSummary(id)`;
- `getDetailedWorkShiftMoneyData(id)`;
- `getWorkShiftPaymentOverviewData(id)`;
- `canStartWorkShift`;
- `canFinishWorkShift(confirm_pass)`.

Полезные типы:

- `WorkShift`: `id`, `worker`, `created_at`, `finished_at`, `events`,
  `money`, `payments`, `cashOrders`;
- `DetailedWorkShiftMoneyData`: `total`, `deposit`, `bonus`, `refunded`,
  `cash`, `card`, `cash_orders`, `worker`, `created_at`, `finished_at`;
- `WorkShiftPaymentOverviewData`: `total`, `deposit`, `online_deposit`,
  `bonus`, `refunded`, `cash`, `card`, `goods`, `services`, `combos`.

Продуктовый потенциал:

- надежнее считать текущую смену не только через общий `eventList`, а через
  shift-specific money overview;
- показать менеджеру детализацию смены: cash/card/deposit/refund/bar/services;
- сверять наши правила мотивации с финансовой сводкой Smartshell;
- добавить экран "закрытие смены" с объяснением расхождений;
- строить рейтинг администраторов по сменам.

Риск:

- реальные данные требуют token;
- надо проверить на живом клубе, совпадает ли `getWorkShiftPaymentOverviewData`
  с текущим расчетом через `eventList`.

### Revenue, Payments, Reports

Полезные queries:

- `eventList(input, page, first)`;
- `salesReport(input)`;
- `overviewReport(input)`;
- `exportOverviewReport(input)`;
- `exportSales(input)`;
- `clientsPaymentReport(input, page, first)`;
- `sessionsMoneyReport(input)`;
- `topSoldOverviewItemsReport(input)`;
- `boughtTariffsReport(input)`;
- `bonusReport(input)`;
- `bonusDetailedSummaryReport(input)`;
- `bonusDetailedTimeSeriesReport(input)`;
- `bonusHistoryReport(input)`;
- `depositTransferReport(input, page, first)`;
- `depositTransferSummaryReport(input)`;
- `paymentTransactions(company_id, page, first)`.

Продуктовый потенциал:

- расширить экспорт без локального хранения;
- добавить "быстрые отчеты" внутри UI вместо скачивания Excel;
- показать топ продаж бара/услуг;
- увидеть продажи тарифов и поминутных сессий;
- сделать live-сравнение план/факт по нескольким категориям;
- добавить мониторинг возвратов и подозрительных операций.

Риск:

- часть отчетов возвращает универсальный `UnifiedReport`, нужно проверить
  реальные labels/keys/data на живом token;
- `eventList` содержит клиентские поля, их нельзя писать в логи/docs.

### Хосты, ПК, Зоны, Загруженность

Полезные queries:

- `hosts`;
- `host(id)`;
- `hostsOverview`;
- `hostGroups`;
- `hostGroupsOverview`;
- `freeHosts`;
- `hostsOccupationReport(input)`;
- `currentHost`;
- `clientHosts(company_id, host_group_id, tariff_id, from)`;
- `clientHostGroups(companyId)`;
- `hostTypes`.

Полезные поля:

- `HostOverview`: `alias`, `group_id`, `type`, `in_service`, `online`,
  `locked`, `bookings`, `user`, `client_sessions`, `comment`,
  `admin_called_at`, `qr`;
- `HostCounters`: `cpu_temp`, `disk_temp`, `disk_status`, `active_window`;
- `ClientHost`: `is_occupied`, `is_booked`, `in_service`, `can_book`.

Продуктовый потенциал:

- live-карта клуба для менеджера/владельца;
- загрузка ПК/PS-зон;
- подсказки "где простаивает дорогая зона";
- техмониторинг: offline, in service, locked, температура CPU/disk;
- виджет "админа вызвали" через `admin_called_at`;
- отчет по занятости host groups.

Риск:

- поля `user` и `client_sessions` могут раскрывать PII, если вытаскивать
  клиента целиком;
- для first version лучше брать только агрегаты и технические поля.

### Товары, Бар, Склад

Полезные queries:

- `goods(input)`;
- `good(id)`;
- `goodHistory(input)`;
- `categories(input)`;
- `category(id)`;
- `exportGoods(input)`;
- `combos`;
- `combo(id)`;
- `comboList(input)`;
- `services(input)`;
- `service(id)`;
- `searchByEan(ean)`.

Полезные поля `Good`:

- `title`, `category`, `amount`, `cost`, `wholesale_cost`, `state`,
  `eans`, `low_stock_notification`, `show_in_shell`, `available_to_buy`.

Продуктовый потенциал:

- контроль заполненности холодильников через остатки;
- low-stock подсказки для менеджера;
- маржинальность бара: price/cost/wholesale cost;
- топ товаров и combo;
- списания/движение товара через `goodHistory`.

Риск:

- надо проверить, насколько `amount` и `state` отражают реальный склад;
- нельзя автоматически штрафовать за холодильник только по API без правил
  соответствия "товар -> холодильник".

### Тарифы И Ценообразование

Полезные queries:

- `tariffs(page, first, filter)`;
- `tariffGrid(input)`;
- `clientTariffGrid(input)`;
- `getCurrentTariff(input)`;
- `boughtTariffsReport(input)`.

Полезные поля `Tariff`:

- `title`, `duration`, `per_minute`, `is_active`, `price_list`, `pausable`,
  `show_in_shell`, `show_in_billing`, `online_booking_enabled`.

Продуктовый потенциал:

- анализ, какие тарифы продаются чаще;
- проверка "дорогие зоны не предлагают";
- подсказки администратору по upsell;
- сравнение дневных/ночных тарифов и планов.

Риск:

- для мотивации важно связать тарифы с категориями `pc`/`ps`/zone;
- нужно подтвердить реальные host group mappings.

### Клиенты И PII

Полезные, но чувствительные queries:

- `clients(input, page, first)`;
- `searchClients(input, page, first)`;
- `clientSession(id)`;
- `getActiveClientList(input, first)`;
- `getDepositHistory(user_id)`;
- `getPaymentsByClientId(uuid, page, first)`;
- `getBonusHistory(uuid, page, first)`;
- `getClientDepositTransfers(uuid, page, first)`;
- `uniqueUsersReport(input)`;
- `leaderboard(companyId, from, to)`.

PII-поля в `User`:

- `login`;
- `nickname`;
- `phone`;
- `email`;
- `dob`;
- social links;
- avatar;
- city.

Продуктовый потенциал:

- новые/возвращающиеся клиенты;
- retention;
- средний чек;
- активные клиенты;
- leaderboard.

Риск:

- это самая чувствительная область;
- нельзя сохранять или логировать phone/email/nickname без отдельной политики;
- для ближайших срезов лучше использовать агрегатные reports без персональных
  строк.

### Бронирования

Полезные queries:

- `getBookings(hostIds, status, from, to, page, first)`;
- `getBooking(id)`;
- `clientBookings(status)`;
- `clientBookingCheckPenalty(id, companyId)`.

Полезные поля:

- `Booking`: `hosts`, `client`, `from`, `to`, `status`, `startsIn`,
  `byClient`;
- `BookingStatus`: `ACTIVE`, `FINISHED`, `CANCELED`, `REDEEMED`,
  `REDEEMED_AUTO`.

Продуктовый потенциал:

- будущая загрузка клуба с учетом броней;
- прогноз ближайшего часа;
- no-show/cancel метрики;
- подсказки по допродажам перед бронью.

Риск:

- `client` может содержать PII;
- надо начинать с агрегатов или host/time/status без клиента.

### Сотрудники, Роли, Задачи

Полезные queries:

- `workers(input, page, first)`;
- `tasks(page, first)`;
- `roles`;
- `permissions`;
- `companyPermissions`.

Полезные mutations, которые пока не трогаем:

- `createWorkerTask`;
- `updateWorkerTask`;
- `setWorkerTaskComplete`;
- `createWorker`;
- `updateWorker`;
- `disableWorker`.

Продуктовый потенциал:

- импорт сотрудников из Smartshell;
- сопоставление Smartshell worker с нашим пользователем;
- проверка задач смены;
- рейтинг по выполненным задачам.

Риск:

- mutations могут менять состояние Smartshell, их нельзя вызывать без
  отдельного согласования;
- сначала только read-only audit.

### Маркетинг, Скидки, Промокоды

Полезные queries:

- `discounts`;
- `discount(id)`;
- `promoCodes`;
- `promoCode(id)`;
- `validatePromoCode(input)`;
- `getAvailableDiscounts`;
- `achievements(user_id)`;
- `leadSourceReport(input)`.

Продуктовый потенциал:

- оценка эффективности промо;
- акции, которые администратор должен проговаривать;
- косвенная проверка скрипта продаж;
- связка с тайным гостем и upsell.

Риск:

- не менять скидки/промокоды через mutations без отдельного feature-среза.

## Mutation Policy

Схема содержит много mutation-операций: смены, платежи, товары, клиенты,
бронования, скидки, хосты, задачи, настройки.

Для ближайших срезов OneGameAdmin должен использовать Smartshell API в
read-only режиме, кроме уже существующего token login. Любая mutation, которая
меняет состояние Smartshell, требует отдельного ТЗ, QA и явного разрешения.

Особенно опасные группы:

- платежи и возвраты: `createPayment`, `refundPayment`,
  `createPaymentTransaction`;
- смены: `startWorkShift`, `finishWorkShift`, `forceFinishWorkShift`;
- клиенты: `setDeposit`, `setBonus`, `banClient`, `verifyUser`;
- товары/склад: `changeGoodsQuantity`, `createGood`, `updateGood`;
- хосты: `setShellMode`, `penaltyHost`, `sendWakePacket`;
- настройки: `setSetting`, `setSettings`, `copySettings`.

## Ближайшие Срезы С Учетом API-First

### Срез 3: Smartshell Adapter Hardening

Цель: сделать единый надежный слой Smartshell API.

Что делать:

- централизовать GraphQL request helper;
- добавить timeout;
- добавить retry только для безопасных read-only запросов;
- нормализовать ошибки `401`, network, GraphQL errors;
- добавить безопасные structured logs без token/credentials/PII;
- добавить helper для query/mutation names и trace id;
- запретить случайное логирование raw response.

Зачем:

- если продукт живет на live API, интеграционный слой должен быть
  предсказуемым;
- сейчас запросы собираются в разных сервисах вручную.

### Срез 4: Current Shift Reliability

Цель: сделать главный экран администратора устойчивее без local DB.

Что делать:

- проверить на real token:
  - `activeWorkShift`;
  - `getWorkShiftPaymentOverviewData(id)`;
  - `getDetailedWorkShiftMoneyData(id)`;
  - текущий `eventList`;
- сравнить результаты;
- выбрать primary source для current stats;
- вернуть в API `source`, `freshness`, `warnings`, `partialData`;
- улучшить error states на frontend.

Зачем:

- текущая панель админа критична для продукта;
- Smartshell API может дать более точную сменную сводку, чем ручная сборка
  `eventList`.

### Срез 5: Smartshell Settings UX And Connection Check

Цель: чтобы platform admin/owner понимали, подключен ли клуб к Smartshell.

Что делать:

- добавить read-only проверку credentials;
- показать результат:
  - token получен;
  - currentClub доступен;
  - activeWorkShift доступен;
  - reports доступны;
  - ошибка credentials/permissions/network;
- не показывать password;
- не писать token в logs/docs.

Зачем:

- SaaS невозможен без понятной диагностики интеграции.

### Срез 6: Reports Expansion

Цель: улучшить отчеты, используя готовые Smartshell report queries.

Что делать:

- проверить `salesReport`, `overviewReport`, `sessionsMoneyReport`,
  `topSoldOverviewItemsReport`, `clientsPaymentReport`;
- добавить UI/Excel для отчетов, которые реально полезны;
- оставить персональные клиентские отчеты только после PII-решения.

Зачем:

- дать владельцу/менеджеру ценность за пределами одной смены.

### Срез 7: Host/Club Load Dashboard

Цель: сделать live-экран загрузки клуба.

Что делать:

- использовать `hostsOverview`, `hostGroupsOverview`,
  `hostsOccupationReport`;
- показать зоны, занятость, offline/in_service/locked, admin call;
- не раскрывать PII клиентов.

Зачем:

- это может стать "вау-фичей" для владельцев и менеджеров клуба.

### Срез 8: Bar/Inventory Insights

Цель: связать мотивацию и операционку бара.

Что делать:

- использовать `goods`, `categories`, `goodHistory`,
  `topSoldOverviewItemsReport`;
- показать low stock и товары, которые продаются/не продаются;
- подготовить основу для проверки холодильников.

Зачем:

- текущая мотивация штрафует за заполненность холодильников, значит системе
  нужна видимость остатков.

## Что Нельзя Делать Автоматически

Пока не принято отдельное решение, не делаем:

- локальное хранение платежей/клиентов;
- автоматический sync;
- вызов Smartshell mutations;
- работу с клиентскими phone/email/nickname;
- payroll snapshot;
- действия, которые меняют смену, деньги, товар, клиента или ПК в Smartshell.

## Следующая Проверка На Живых Credentials

Schema показывает возможности, но не гарантирует права конкретного manager
account. Следующий технический smoke должен выполняться через существующие
credentials клуба и проверять read-only операции:

```graphql
query {
  currentClub { id name }
  activeWorkShift { id created_at worker { id first_name last_name } }
}
```

И отдельно для конкретной смены:

```graphql
query WorkShiftMoney($id: Int) {
  getWorkShiftPaymentOverviewData(id: $id) {
    id
    total
    deposit
    online_deposit
    bonus
    refunded
    cash
    card
    goods { title amount sum }
    services { title amount sum }
    combos { title amount sum }
  }
}
```

Если эти queries доступны на manager account, их стоит использовать в срезе
`Current Shift Reliability`.
