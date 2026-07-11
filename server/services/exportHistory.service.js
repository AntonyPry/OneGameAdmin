'use strict';

const { ExportHistory, User } = require('../models');

const REPORT_TYPES = Object.freeze({
  PAYMENTS: 'payments',
  SBP: 'sbp',
  CASH_ORDERS: 'cash_orders',
  FIRST_SESSIONS: 'first_sessions',
});

const EXPORT_STATUSES = Object.freeze({
  PENDING: 'pending',
  SUCCESS: 'success',
  ERROR: 'error',
});

const USER_PUBLIC_ATTRIBUTES = [
  'id',
  'email',
  'first_name',
  'last_name',
  'system_role',
  'free_trial_expires_at',
];

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const toDateOrNull = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalizedValue = String(value).trim().replace(' ', 'T');
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const serializeUser = (user) => {
  const plainUser = user?.get ? user.get({ plain: true }) : user;
  if (!plainUser) return null;

  return {
    id: plainUser.id,
    email: plainUser.email,
    firstName: plainUser.first_name,
    first_name: plainUser.first_name,
    lastName: plainUser.last_name,
    last_name: plainUser.last_name,
    systemRole: plainUser.system_role,
    system_role: plainUser.system_role,
    freeTrialExpiresAt: plainUser.free_trial_expires_at,
    free_trial_expires_at: plainUser.free_trial_expires_at,
  };
};

const serializeExportHistory = (history) => {
  const plainHistory = history?.get
    ? history.get({ plain: true })
    : history;
  const user = serializeUser(plainHistory.user);

  return {
    id: plainHistory.id,
    clubId: plainHistory.club_id,
    club_id: plainHistory.club_id,
    userId: plainHistory.user_id,
    user_id: plainHistory.user_id,
    reportType: plainHistory.report_type,
    report_type: plainHistory.report_type,
    startDate: plainHistory.start_date,
    start_date: plainHistory.start_date,
    endDate: plainHistory.end_date,
    end_date: plainHistory.end_date,
    status: plainHistory.status,
    errorMessage: plainHistory.error_message,
    error_message: plainHistory.error_message,
    exportedBy: user,
    exported_by: user,
    createdAt: plainHistory.createdAt,
    updatedAt: plainHistory.updatedAt,
  };
};

const createExportHistory = async ({
  clubId,
  userId,
  reportType,
  startDate,
  endDate,
}) => {
  const history = await ExportHistory.create({
    club_id: clubId,
    user_id: userId || null,
    report_type: reportType,
    start_date: toDateOrNull(startDate),
    end_date: toDateOrNull(endDate),
    status: EXPORT_STATUSES.PENDING,
    error_message: null,
  });

  return history;
};

const markExportHistorySuccess = async (history) => {
  if (!history) return null;

  const updatedHistory = await history.update({
    status: EXPORT_STATUSES.SUCCESS,
    error_message: null,
  });

  return updatedHistory;
};

const markExportHistoryError = async (history, errorMessage) => {
  if (!history) return null;

  const updatedHistory = await history.update({
    status: EXPORT_STATUSES.ERROR,
    error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
  });

  return updatedHistory;
};

const listExportHistory = async ({ clubId, limit }) => {
  const rows = await ExportHistory.findAll({
    where: { club_id: clubId },
    include: [
      {
        model: User,
        as: 'user',
        attributes: USER_PUBLIC_ATTRIBUTES,
        required: false,
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: toLimit(limit),
  });

  return rows.map(serializeExportHistory);
};

module.exports = {
  REPORT_TYPES,
  EXPORT_STATUSES,
  createExportHistory,
  markExportHistorySuccess,
  markExportHistoryError,
  listExportHistory,
};
