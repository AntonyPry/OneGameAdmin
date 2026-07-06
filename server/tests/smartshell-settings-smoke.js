'use strict';

process.env.CREDENTIALS_ENCRYPTION_KEY =
  process.env.CREDENTIALS_ENCRYPTION_KEY ||
  'smoke-test-key-that-is-longer-than-32-chars';

const assert = require('assert');
const { __testing } = require('../services/platform.service');
const { normalizeClubSettings } = require('../utils/clubSettings');
const { decryptCredential } = require('../utils/credentialsCrypto');

const club = { id: 1, smartshell_id: 6816 };

const saveSettings = (currentSettings, patch) =>
  __testing.mergeSettingsPatch({
    currentSettings,
    patch,
    club,
    allowSmartshell: true,
    allowCustomSettings: false,
  });

const initialSettings = saveSettings(
  { smartshell: { companyId: 6816 } },
  {
    smartshell: {
      companyId: 6816,
      managerLogin: 'manager@example.com',
      managerPassword: 'first-password',
    },
  },
);
const initialSmartshell = normalizeClubSettings(initialSettings, club).smartshell;

assert.strictEqual(initialSmartshell.companyId, 6816);
assert.strictEqual(initialSmartshell.managerLogin, 'manager@example.com');
assert.strictEqual(initialSmartshell.hasManagerCredentials, true);
assert.strictEqual(
  decryptCredential(initialSmartshell.managerPasswordEncrypted),
  'first-password',
);

const serialized = __testing.sanitizeSettingsForResponse(initialSettings, {
  includeSmartshellManagerLogin: true,
});
assert.strictEqual(
  serialized.smartshell.managerLogin,
  'manager@example.com',
);
assert.strictEqual(serialized.smartshell.hasManagerCredentials, true);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(
    serialized.smartshell,
    'managerPasswordEncrypted',
  ),
  false,
);
assert.strictEqual(JSON.stringify(serialized).includes('first-password'), false);

const keepOldPassword = saveSettings(initialSettings, {
  smartshell: {
    managerLogin: 'updated-manager@example.com',
    managerPassword: '',
  },
});
const keptSmartshell = normalizeClubSettings(keepOldPassword, club).smartshell;
assert.strictEqual(
  keptSmartshell.managerPasswordEncrypted,
  initialSmartshell.managerPasswordEncrypted,
);
assert.strictEqual(
  decryptCredential(keptSmartshell.managerPasswordEncrypted),
  'first-password',
);

const replacePassword = saveSettings(keepOldPassword, {
  smartshell: {
    managerPassword: 'second-password',
  },
});
const replacedSmartshell = normalizeClubSettings(replacePassword, club).smartshell;
assert.notStrictEqual(
  replacedSmartshell.managerPasswordEncrypted,
  keptSmartshell.managerPasswordEncrypted,
);
assert.strictEqual(
  decryptCredential(replacedSmartshell.managerPasswordEncrypted),
  'second-password',
);

const motivationAndSmartshell = saveSettings(replacePassword, {
  motivation: {
    penalties: {
      secretGuestFailed: 1300,
    },
  },
  smartshell: {
    managerLogin: 'manager-after-motivation@example.com',
    managerPassword: '',
  },
});
const normalizedMotivationAndSmartshell = normalizeClubSettings(
  motivationAndSmartshell,
  club,
);
assert.strictEqual(
  normalizedMotivationAndSmartshell.motivation.penalties.secretGuestFailed,
  1300,
);
assert.strictEqual(
  normalizedMotivationAndSmartshell.smartshell.managerPasswordEncrypted,
  replacedSmartshell.managerPasswordEncrypted,
);

assert.throws(
  () =>
    saveSettings(replacePassword, {
      motivation: {
        penalties: {
          secretToken: 1,
        },
      },
    }),
  /похоже на секрет/,
);

console.log('smartshell settings smoke passed');
