'use strict';

const bcrypt = require('bcrypt');
const { QueryTypes } = require('sequelize');

const getEnv = (primary, fallback) => process.env[primary] || process.env[fallback];

const getBootstrapConfig = () => {
  const email = getEnv('BOOTSTRAP_ADMIN_EMAIL', 'DEV_SEED_ADMIN_EMAIL');
  const password = getEnv('BOOTSTRAP_ADMIN_PASSWORD', 'DEV_SEED_ADMIN_PASSWORD');

  if (!email && !password) return null;

  if (!email || !password) {
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set together',
    );
  }

  if (String(password).length < 8) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters');
  }

  return {
    email: String(email).trim().toLowerCase(),
    password: String(password),
    firstName: process.env.BOOTSTRAP_ADMIN_FIRST_NAME || 'Platform',
    lastName: process.env.BOOTSTRAP_ADMIN_LAST_NAME || 'Admin',
  };
};

const assertSystemRoleColumnExists = async (queryInterface) => {
  const table = await queryInterface.describeTable('Users');
  if (!table.system_role) {
    throw new Error(
      'Users.system_role is missing. Run migrations before bootstrap seeder.',
    );
  }
};

module.exports = {
  async up(queryInterface) {
    const config = getBootstrapConfig();
    if (!config) return;

    await assertSystemRoleColumnExists(queryInterface);

    const existingUsers = await queryInterface.sequelize.query(
      'SELECT id FROM Users WHERE email = :email LIMIT 1',
      {
        replacements: { email: config.email },
        type: QueryTypes.SELECT,
      },
    );

    const now = new Date();

    if (existingUsers.length) {
      await queryInterface.bulkUpdate(
        'Users',
        {
          system_role: 'platform_admin',
          updatedAt: now,
        },
        { email: config.email },
      );
      return;
    }

    const passwordHash = await bcrypt.hash(config.password, 10);

    await queryInterface.bulkInsert('Users', [
      {
        email: config.email,
        password_hash: passwordHash,
        first_name: config.firstName,
        last_name: config.lastName,
        system_role: 'platform_admin',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down() {
    // Intentionally no-op: do not delete or downgrade real admin accounts.
  },
};
