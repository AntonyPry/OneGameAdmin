'use strict';

const assert = require('assert');
const bcrypt = require('bcrypt');
const platformService = require('../services/platform.service');
const { Club, User, UserClub, sequelize } = require('../models');

const originalFindOne = User.findOne;
const originalCreate = User.create;
const originalFindByPk = Club.findByPk;
const originalUserClubCreate = UserClub.create;
const originalTransaction = sequelize.transaction;

const restoreUserModel = () => {
  User.findOne = originalFindOne;
  User.create = originalCreate;
  Club.findByPk = originalFindByPk;
  UserClub.create = originalUserClubCreate;
  sequelize.transaction = originalTransaction;
};

const expectApiError = async (action, message) => {
  await assert.rejects(
    action,
    (error) =>
      error instanceof platformService.ApiError &&
      error.status === 400 &&
      error.message === message,
  );
};

const basePayload = {
  email: 'created-user@example.test',
  first_name: 'Created',
  last_name: 'User',
  system_role: 'user',
};
const currentClubBasePayload = {
  email: 'current-club-user@example.test',
  first_name: 'Created',
  last_name: 'User',
  role: 'manager',
};

(async () => {
  try {
    User.findOne = async () => null;

    await expectApiError(
      () =>
        platformService.createUser({
          ...basePayload,
          initialPassword: 'LegacyOnlyPassword',
        }),
      'Пароль обязателен',
    );

    await expectApiError(
      () =>
        platformService.createUser({
          ...basePayload,
          password: 'ValidCreatePassword',
        }),
      'Повторите пароль',
    );

    await expectApiError(
      () =>
        platformService.createUser({
          ...basePayload,
          password: 'ValidCreatePassword',
          passwordConfirmation: 'DifferentCreatePassword',
        }),
      'Пароли не совпадают',
    );

    await expectApiError(
      () =>
        platformService.createUser({
          ...basePayload,
          password: 'short',
          passwordConfirmation: 'short',
        }),
      'Пароль должен быть не короче 8 символов',
    );

    await expectApiError(
      () =>
        platformService.createCurrentClubUser(1, {
          ...currentClubBasePayload,
          password: 'ValidCreatePassword',
        }),
      'Повторите пароль',
    );

    let createdRow = null;
    let nextUserId = 42;
    User.create = async (payload) => {
      createdRow = payload;
      return {
        id: nextUserId += 1,
        email: payload.email,
        first_name: payload.first_name,
        last_name: payload.last_name,
        system_role: payload.system_role,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      };
    };

    const user = await platformService.createUser({
      ...basePayload,
      password: 'ValidCreatePassword',
      passwordConfirmation: 'ValidCreatePassword',
    });

    assert(createdRow.password_hash, 'password_hash must be saved');
    assert.notStrictEqual(createdRow.password_hash, 'ValidCreatePassword');
    assert.strictEqual(
      await bcrypt.compare('ValidCreatePassword', createdRow.password_hash),
      true,
    );

    const serialized = JSON.stringify(user);
    assert.strictEqual(serialized.includes('password'), false);
    assert.strictEqual(serialized.includes('password_hash'), false);

    Club.findByPk = async () => ({
      id: 1,
      smartshell_id: 6816,
      name: 'Smoke Club',
      address: 'Smoke Address',
      opening_date: null,
      settings: {},
    });
    UserClub.create = async (payload) => ({
      id: 7,
      user_id: payload.user_id,
      club_id: payload.club_id,
      role: payload.role,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    sequelize.transaction = async (callback) => callback({});

    const currentClubUser = await platformService.createCurrentClubUser(1, {
      ...currentClubBasePayload,
      password: 'ValidCreatePassword',
      passwordConfirmation: 'ValidCreatePassword',
    });

    assert(createdRow.password_hash, 'current club password_hash must be saved');
    assert.strictEqual(
      await bcrypt.compare('ValidCreatePassword', createdRow.password_hash),
      true,
    );
    const serializedCurrentClubUser = JSON.stringify(currentClubUser);
    assert.strictEqual(serializedCurrentClubUser.includes('password'), false);
    assert.strictEqual(
      serializedCurrentClubUser.includes('password_hash'),
      false,
    );
  } finally {
    restoreUserModel();
  }

  console.log('platform user password smoke passed');
})().catch((error) => {
  restoreUserModel();
  console.error(error);
  process.exit(1);
});
