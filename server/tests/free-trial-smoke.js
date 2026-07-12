'use strict';

const assert = require('assert');
const { serializeUserSession } = require('../services/auth.service');
const {
  getFreeTrialFields,
  isFreeTrialActive,
  parseFreeTrialExpiresAt,
  validateTrialDateRange,
} = require('../utils/freeTrial');

const now = new Date(2026, 6, 10, 12, 0, 0);
const activeUser = {
  id: 1,
  email: 'trial@example.test',
  first_name: 'Trial',
  last_name: 'User',
  system_role: 'user',
  free_trial_expires_at: new Date(2026, 6, 17, 23, 59, 59),
  clubs: [],
};

const dateOnly = parseFreeTrialExpiresAt('2026-07-17');
assert.strictEqual(dateOnly.getFullYear(), 2026);
assert.strictEqual(dateOnly.getMonth(), 6);
assert.strictEqual(dateOnly.getDate(), 17);
assert.strictEqual(dateOnly.getHours(), 23);
assert.throws(
  () => parseFreeTrialExpiresAt('17.07.2026'),
  /YYYY-MM-DD/,
);

assert.strictEqual(isFreeTrialActive(activeUser, now), true);
assert.strictEqual(
  getFreeTrialFields(activeUser, now).freeTrialDaysLeft,
  8,
);

const session = serializeUserSession(activeUser);
assert.strictEqual(session.user.freeTrialExpiresAt.endsWith('Z'), true);
assert.strictEqual(session.user.isFreeTrial, true);
assert.strictEqual(session.isFreeTrial, true);

const allowed = validateTrialDateRange(activeUser, {
  startDate: '2026-07-04 00:00:00',
  endDate: '2026-07-10 23:59:59',
  now,
});
assert.strictEqual(allowed.ok, true);

const blocked = validateTrialDateRange(activeUser, {
  startDate: '2026-07-03 23:59:59',
  endDate: '2026-07-10 23:59:59',
  now,
});
assert.strictEqual(blocked.ok, false);
assert.strictEqual(blocked.statusCode, 403);
assert.strictEqual(blocked.code, 'FREE_TRIAL_WINDOW_EXCEEDED');

const nonTrialAllowed = validateTrialDateRange(
  { id: 2, free_trial_expires_at: null },
  {
    startDate: '2026-01-01 00:00:00',
    endDate: '2026-07-10 23:59:59',
    now,
  },
);
assert.strictEqual(nonTrialAllowed.ok, true);

console.log('free trial smoke passed');
