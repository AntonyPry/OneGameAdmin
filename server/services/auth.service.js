'use strict';

const jwt = require('jsonwebtoken');
const { User, Club } = require('../models');
const { normalizeClubRole, normalizeSystemRole } = require('../rbac/roles');

const USER_PUBLIC_ATTRIBUTES = [
  'id',
  'email',
  'first_name',
  'last_name',
  'system_role',
];

const CLUB_PUBLIC_ATTRIBUTES = [
  'id',
  'smartshell_id',
  'name',
  'address',
  'opening_date',
];

const membershipInclude = [
  {
    model: Club,
    as: 'clubs',
    attributes: CLUB_PUBLIC_ATTRIBUTES,
    through: {
      attributes: ['id', 'user_id', 'club_id', 'role'],
    },
  },
];

const getUserWithMembershipsById = (id) =>
  User.findByPk(id, {
    attributes: USER_PUBLIC_ATTRIBUTES,
    include: membershipInclude,
  });

const getUserWithPasswordAndMembershipsByEmail = (email) =>
  User.findOne({
    where: { email },
    attributes: [...USER_PUBLIC_ATTRIBUTES, 'password_hash'],
    include: membershipInclude,
  });

const serializeMembership = (club) => {
  const plainClub = club?.get ? club.get({ plain: true }) : club;
  const userClub = plainClub?.UserClub || {};
  const dbRole = userClub.role || null;
  const role = normalizeClubRole(dbRole);

  return {
    id: userClub.id || null,
    userId: userClub.user_id || null,
    clubId: plainClub.id,
    role,
    dbRole,
    club: {
      id: plainClub.id,
      smartshellId: plainClub.smartshell_id,
      smartshell_id: plainClub.smartshell_id,
      name: plainClub.name,
      address: plainClub.address,
      openingDate: plainClub.opening_date,
      opening_date: plainClub.opening_date,
    },
  };
};

const serializeClub = (club) => {
  const plainClub = club?.get ? club.get({ plain: true }) : club;
  const membership = serializeMembership(plainClub);

  return {
    id: plainClub.id,
    smartshellId: plainClub.smartshell_id,
    smartshell_id: plainClub.smartshell_id,
    name: plainClub.name,
    address: plainClub.address,
    openingDate: plainClub.opening_date,
    opening_date: plainClub.opening_date,
    role: membership.role,
    membership,
    UserClub: {
      ...(plainClub.UserClub || {}),
      canonicalRole: membership.role,
    },
  };
};

const serializeUserSession = (user) => {
  const plainUser = user?.get ? user.get({ plain: true }) : user;
  const systemRole = normalizeSystemRole(plainUser.system_role);
  const clubs = (plainUser.clubs || []).map(serializeClub);
  const memberships = clubs.map((club) => club.membership);

  return {
    user: {
      id: plainUser.id,
      email: plainUser.email,
      first_name: plainUser.first_name,
      last_name: plainUser.last_name,
      firstName: plainUser.first_name,
      lastName: plainUser.last_name,
      systemRole,
      system_role: systemRole,
      clubs,
    },
    systemRole,
    system_role: systemRole,
    clubs,
    memberships,
  };
};

const createAccessToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      system_role: normalizeSystemRole(user.system_role),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
  );
};

module.exports = {
  getUserWithMembershipsById,
  getUserWithPasswordAndMembershipsByEmail,
  serializeUserSession,
  createAccessToken,
};
