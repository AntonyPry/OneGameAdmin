'use strict';

const SYSTEM_ROLE_COLUMN = 'system_role';

const hasColumn = async (queryInterface, tableName, columnName) => {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table[columnName]);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await hasColumn(queryInterface, 'Users', SYSTEM_ROLE_COLUMN);
    if (exists) return;

    await queryInterface.addColumn('Users', SYSTEM_ROLE_COLUMN, {
      type: Sequelize.ENUM('user', 'platform_admin'),
      allowNull: false,
      defaultValue: 'user',
      after: 'last_name',
    });
  },

  async down(queryInterface) {
    const exists = await hasColumn(queryInterface, 'Users', SYSTEM_ROLE_COLUMN);
    if (!exists) return;

    await queryInterface.removeColumn('Users', SYSTEM_ROLE_COLUMN);
  },
};
