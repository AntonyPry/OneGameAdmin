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

const getCurrentSettings = async (req, res) => {
  try {
    const club = await platformService.getCurrentClubSettings(req.dbClubId);
    return res.status(200).send({
      error: false,
      club,
      settings: club.settings,
    });
  } catch (error) {
    return handleControllerError(res, error, 'clubs.getCurrentSettings');
  }
};

const updateCurrentSettings = async (req, res) => {
  try {
    const settingsPatch = getSettingsPatch(req.body);
    const club = await platformService.updateCurrentClubSettings(
      req.dbClubId,
      settingsPatch,
    );
    return res.status(200).send({
      error: false,
      club,
      settings: club.settings,
    });
  } catch (error) {
    return handleControllerError(res, error, 'clubs.updateCurrentSettings');
  }
};

const listCurrentUsers = async (req, res) => {
  try {
    const users = await platformService.listCurrentClubUsers(req.dbClubId);
    return res.status(200).send({ error: false, users });
  } catch (error) {
    return handleControllerError(res, error, 'clubs.listCurrentUsers');
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await platformService.getCurrentClubUser(
      req.dbClubId,
      req.params.userId,
    );
    return res.status(200).send({ error: false, user });
  } catch (error) {
    return handleControllerError(res, error, 'clubs.getCurrentUser');
  }
};

const createCurrentUser = async (req, res) => {
  try {
    const user = await platformService.createCurrentClubUser(
      req.dbClubId,
      req.body || {},
    );
    return res.status(201).send({ error: false, user });
  } catch (error) {
    return handleControllerError(res, error, 'clubs.createCurrentUser');
  }
};

const updateCurrentUser = async (req, res) => {
  try {
    const user = await platformService.updateCurrentClubUser(
      req.dbClubId,
      req.params.userId,
      req.body || {},
    );
    return res.status(200).send({ error: false, user });
  } catch (error) {
    return handleControllerError(res, error, 'clubs.updateCurrentUser');
  }
};

const upsertCurrentUserMembership = async (req, res) => {
  try {
    const user = await platformService.upsertCurrentClubUserMembership(
      req.dbClubId,
      req.params.userId,
      req.body || {},
      { actorUserId: req.user.id },
    );
    return res.status(200).send({ error: false, user });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      'clubs.upsertCurrentUserMembership',
    );
  }
};

const updateCurrentUserMembership = async (req, res) => {
  try {
    const user = await platformService.updateCurrentClubUserMembership(
      req.dbClubId,
      req.params.userId,
      req.body || {},
      { actorUserId: req.user.id },
    );
    return res.status(200).send({ error: false, user });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      'clubs.updateCurrentUserMembership',
    );
  }
};

const removeCurrentUserMembership = async (req, res) => {
  try {
    const user = await platformService.removeCurrentClubUserMembership(
      req.dbClubId,
      req.params.userId,
      { actorUserId: req.user.id },
    );
    return res.status(200).send({ error: false, user });
  } catch (error) {
    return handleControllerError(
      res,
      error,
      'clubs.removeCurrentUserMembership',
    );
  }
};

module.exports = {
  getCurrentSettings,
  updateCurrentSettings,
  listCurrentUsers,
  getCurrentUser,
  createCurrentUser,
  updateCurrentUser,
  upsertCurrentUserMembership,
  updateCurrentUserMembership,
  removeCurrentUserMembership,
};
