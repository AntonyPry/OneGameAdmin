'use strict';

const platformService = require('../services/platform.service');

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object || {}, key);

const getSettingsPatch = (body) =>
  hasOwn(body, 'settings') ? body.settings : body || {};

const handleControllerError = (res, error, label) => {
  if (error instanceof platformService.ApiError) {
    return res.status(error.status).send({
      error: true,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  console.error(`${label} ERROR ->`, error);
  return res
    .status(500)
    .send({ error: true, message: 'Внутренняя ошибка сервера' });
};

const listClubs = async (req, res) => {
  try {
    const clubs = await platformService.listClubs();
    return res.status(200).send({ error: false, clubs });
  } catch (error) {
    return handleControllerError(res, error, 'platform.listClubs');
  }
};

const getClub = async (req, res) => {
  try {
    const club = await platformService.getClub(req.params.clubId);
    return res.status(200).send({ error: false, club });
  } catch (error) {
    return handleControllerError(res, error, 'platform.getClub');
  }
};

const createClub = async (req, res) => {
  try {
    const club = await platformService.createClub(req.body || {});
    return res.status(201).send({ error: false, club });
  } catch (error) {
    return handleControllerError(res, error, 'platform.createClub');
  }
};

const updateClub = async (req, res) => {
  try {
    const club = await platformService.updateClub(
      req.params.clubId,
      req.body || {},
    );
    return res.status(200).send({ error: false, club });
  } catch (error) {
    return handleControllerError(res, error, 'platform.updateClub');
  }
};

const updateClubSettings = async (req, res) => {
  try {
    const settingsPatch = getSettingsPatch(req.body);
    const club = await platformService.updateClubSettings(
      req.params.clubId,
      settingsPatch,
    );
    return res.status(200).send({ error: false, club });
  } catch (error) {
    return handleControllerError(res, error, 'platform.updateClubSettings');
  }
};

const listUsers = async (req, res) => {
  try {
    const users = await platformService.listUsers();
    return res.status(200).send({ error: false, users });
  } catch (error) {
    return handleControllerError(res, error, 'platform.listUsers');
  }
};

const getUser = async (req, res) => {
  try {
    const user = await platformService.getUser(req.params.userId);
    return res.status(200).send({ error: false, user });
  } catch (error) {
    return handleControllerError(res, error, 'platform.getUser');
  }
};

const createUser = async (req, res) => {
  try {
    const user = await platformService.createUser(req.body || {});
    return res.status(201).send({ error: false, user });
  } catch (error) {
    return handleControllerError(res, error, 'platform.createUser');
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await platformService.updateUser(
      req.params.userId,
      req.body || {},
      { actorUserId: req.user.id },
    );
    return res.status(200).send({ error: false, user });
  } catch (error) {
    return handleControllerError(res, error, 'platform.updateUser');
  }
};

const removeUser = async (req, res) => {
  try {
    const user = await platformService.removeUser(req.params.userId, {
      actorUserId: req.user.id,
    });
    return res.status(200).send({ error: false, user });
  } catch (error) {
    return handleControllerError(res, error, 'platform.removeUser');
  }
};

const upsertUserMembership = async (req, res) => {
  try {
    const membership = await platformService.upsertUserMembership(
      req.params.userId,
      req.body || {},
    );
    return res.status(200).send({ error: false, membership });
  } catch (error) {
    return handleControllerError(res, error, 'platform.upsertUserMembership');
  }
};

const updateUserMembership = async (req, res) => {
  try {
    const membership = await platformService.updateUserMembership(
      req.params.userId,
      req.params.clubId,
      req.body || {},
    );
    return res.status(200).send({ error: false, membership });
  } catch (error) {
    return handleControllerError(res, error, 'platform.updateUserMembership');
  }
};

const removeUserMembership = async (req, res) => {
  try {
    const membership = await platformService.removeUserMembership(
      req.params.userId,
      req.params.clubId,
    );
    return res.status(200).send({ error: false, membership });
  } catch (error) {
    return handleControllerError(res, error, 'platform.removeUserMembership');
  }
};

module.exports = {
  listClubs,
  getClub,
  createClub,
  updateClub,
  updateClubSettings,
  listUsers,
  getUser,
  createUser,
  updateUser,
  removeUser,
  upsertUserMembership,
  updateUserMembership,
  removeUserMembership,
};
