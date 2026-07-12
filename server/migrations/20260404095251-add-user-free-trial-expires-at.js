'use strict';

const FREE_TRIAL_COLUMN = 'free_trial_expires_at';

const hasColumn = async (queryInterface, tableName, columnName) => {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table[columnName]);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await hasColumn(queryInterface, 'Users', FREE_TRIAL_COLUMN);
    if (exists) return;

    await queryInterface.addColumn('Users', FREE_TRIAL_COLUMN, {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'system_role',
    });
  },

  async down(queryInterface) {
    const exists = await hasColumn(queryInterface, 'Users', FREE_TRIAL_COLUMN);
    if (!exists) return;

    await queryInterface.removeColumn('Users', FREE_TRIAL_COLUMN);
  },
};
