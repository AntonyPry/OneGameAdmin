'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

const { Club, sequelize } = require('../models');
const { normalizeClubSettings } = require('../utils/clubSettings');

const DEFAULT_CURRENT_CLUB = Object.freeze({
  smartshellId: 6816,
  name: 'Основной клуб',
  address: 'г. Москва, ул. Ленина, д. 1',
  openingDate: '2024-12-01T00:00:00Z',
});

const REQUIRED_DB_ENV = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'];

const isPlainObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (target, source) => {
  if (!isPlainObject(source)) return { ...target };

  return Object.entries(source).reduce(
    (merged, [key, value]) => ({
      ...merged,
      [key]:
        isPlainObject(value) && isPlainObject(merged[key])
          ? deepMerge(merged[key], value)
          : value,
    }),
    { ...target },
  );
};

const parsePositiveInteger = (value, fallback, label) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
};

const parseDate = (value, label) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
  return date;
};

const parseSettingsOverride = () => {
  const rawValue = process.env.CURRENT_CLUB_SETTINGS_JSON;
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (!isPlainObject(parsed)) {
      throw new Error('value must be a JSON object');
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `CURRENT_CLUB_SETTINGS_JSON must be valid JSON object: ${error.message}`,
    );
  }
};

const assertDbEnv = () => {
  const missing = REQUIRED_DB_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required DB env: ${missing.join(
        ', ',
      )}. Fill server/.env before running this script.`,
    );
  }
};

const getCurrentClubConfig = () => {
  const smartshellId = parsePositiveInteger(
    process.env.CURRENT_CLUB_SMARTSHELL_ID,
    DEFAULT_CURRENT_CLUB.smartshellId,
    'CURRENT_CLUB_SMARTSHELL_ID',
  );

  return {
    smartshellId,
    name: process.env.CURRENT_CLUB_NAME || DEFAULT_CURRENT_CLUB.name,
    address: process.env.CURRENT_CLUB_ADDRESS || DEFAULT_CURRENT_CLUB.address,
    openingDate: parseDate(
      process.env.CURRENT_CLUB_OPENING_DATE ||
        DEFAULT_CURRENT_CLUB.openingDate,
      'CURRENT_CLUB_OPENING_DATE',
    ),
    settingsOverride: parseSettingsOverride(),
  };
};

const buildSettings = (existingClub, config) => {
  const existingSettings = normalizeClubSettings(existingClub?.settings || {}, {
    smartshell_id: config.smartshellId,
  });
  const settings = deepMerge(existingSettings, config.settingsOverride);
  const normalized = normalizeClubSettings(settings, {
    smartshell_id: config.smartshellId,
  });

  return {
    ...normalized,
    smartshell: {
      ...normalized.smartshell,
      companyId: config.smartshellId,
    },
  };
};

const upsertCurrentClub = async () => {
  assertDbEnv();
  const config = getCurrentClubConfig();

  await sequelize.authenticate();

  return sequelize.transaction(async (transaction) => {
    const existingClub = await Club.findOne({
      where: { smartshell_id: config.smartshellId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const payload = {
      smartshell_id: config.smartshellId,
      name: config.name,
      address: config.address,
      opening_date: config.openingDate,
      settings: buildSettings(existingClub, config),
    };

    if (existingClub) {
      await existingClub.update(payload, { transaction });
      return { action: 'updated', club: existingClub };
    }

    const club = await Club.create(payload, { transaction });
    return { action: 'created', club };
  });
};

const main = async () => {
  try {
    const result = await upsertCurrentClub();
    const club = result.club.get({ plain: true });

    console.log(
      JSON.stringify(
        {
          ok: true,
          action: result.action,
          club: {
            id: club.id,
            smartshellId: club.smartshell_id,
            name: club.name,
            address: club.address,
          },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error.message,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

main();
