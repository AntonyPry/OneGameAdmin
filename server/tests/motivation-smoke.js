'use strict';

const assert = require('assert');
const { normalizeClubSettings } = require('../utils/clubSettings');
const {
  normalizeShiftCheckPayload,
  calculateMotivationPayout,
} = require('../utils/motivation');

const { motivation } = normalizeClubSettings({});

const fullCheckPayload = {
  allTasksCompleted: true,
  longMessageResponseCount: 0,
  uncleanClubPlacesCount: 0,
  dirtyKitchen: false,
  missedCallNoCallbackCount: 0,
  messyWorkspace: false,
  strangersBehindDesk: false,
  climateControlIssue: false,
  fridgeNotFilled: false,
  loudSwearingCount: 0,
  secretGuestFailed: false,
  secretGuestFailureReasons: {
    noTour: false,
    promotionsNotExplained: false,
    scriptNotFollowed: false,
    noUpsellAttempt: false,
    noFoodDrinkOrServiceOffer: false,
  },
};

const normalizeCheck = (payload) => normalizeShiftCheckPayload(payload);

const checkedShift = (payload = fullCheckPayload) => {
  const normalized = normalizeCheck(payload);
  assert.deepStrictEqual(normalized.errors, []);

  return {
    alreadyChecked: true,
    status: 'ok',
    checklist: normalized.normalizedCheck,
  };
};

const payout = ({
  shiftType = 'day',
  currentStatsObject = {},
  planStatsObject = {},
  checkPayload = fullCheckPayload,
} = {}) =>
  calculateMotivationPayout({
    shiftType,
    currentStatsObject,
    planStatsObject: { isConfigured: true, ...planStatsObject },
    motivation,
    shiftCheck: checkedShift(checkPayload),
  });

const incompletePayload = normalizeCheck({ allTasksCompleted: true });
assert(
  incompletePayload.errors.includes('longMessageResponseCount обязателен'),
  'missing counters must be rejected',
);

const unknownTopLevel = normalizeCheck({
  ...fullCheckPayload,
  unexpectedField: true,
});
assert(
  unknownTopLevel.errors.includes('unexpectedField не поддерживается'),
  'unknown top-level keys must be rejected',
);

const unknownSecretGuestReason = normalizeCheck({
  ...fullCheckPayload,
  secretGuestFailureReasons: {
    ...fullCheckPayload.secretGuestFailureReasons,
    mysteryReason: true,
  },
});
assert(
  unknownSecretGuestReason.errors.includes(
    'secretGuestFailureReasons.mysteryReason не поддерживается',
  ),
  'unknown secret guest reason keys must be rejected',
);

const noPlanMet = payout({
  currentStatsObject: {
    barRevenue: 1000,
    servicesRevenue: 1000,
    totalRevenue: 1000,
  },
  planStatsObject: { totalRevenue: 5000 },
});
assert.strictEqual(noPlanMet.baseSalary, 1000);
assert.strictEqual(noPlanMet.taskCompletionBonus, 1200);
assert.strictEqual(noPlanMet.barBonus, 50);
assert.strictEqual(noPlanMet.servicesBonus, 100);
assert.strictEqual(noPlanMet.planMultiplierApplied, false);

const planMet = payout({
  shiftType: 'night',
  currentStatsObject: {
    barRevenue: 1000,
    servicesRevenue: 1000,
    totalRevenue: 6000,
  },
  planStatsObject: { totalRevenue: 5000 },
});
assert.strictEqual(planMet.baseSalary, 1200);
assert.strictEqual(planMet.barBonus, 100);
assert.strictEqual(planMet.servicesBonus, 200);
assert.strictEqual(planMet.planMultiplierApplied, true);

assert.strictEqual(
  payout({
    checkPayload: { ...fullCheckPayload, longMessageResponseCount: 3 },
  }).penaltiesTotal,
  1200,
);
assert.strictEqual(
  payout({
    checkPayload: { ...fullCheckPayload, uncleanClubPlacesCount: 5 },
  }).penaltiesTotal,
  600,
);
assert.strictEqual(
  payout({
    checkPayload: { ...fullCheckPayload, uncleanClubPlacesCount: 6 },
  }).penaltiesTotal,
  1200,
);
assert.strictEqual(
  payout({
    checkPayload: { ...fullCheckPayload, loudSwearingCount: 2 },
  }).penaltiesTotal,
  200,
);
assert.strictEqual(
  payout({
    checkPayload: {
      ...fullCheckPayload,
      secretGuestFailureReasons: {
        ...fullCheckPayload.secretGuestFailureReasons,
        noTour: true,
      },
    },
  }).penaltiesTotal,
  1200,
);

console.log('motivation smoke passed');
