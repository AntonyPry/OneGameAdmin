'use strict';

const TABLE_NAME = 'MonthlyPlans';

const COLUMNS = {
  barRevenue: { type: 'INTEGER', defaultValue: 0 },
  psRevenue: { type: 'INTEGER', defaultValue: 0 },
  servicesRevenue: { type: 'INTEGER', defaultValue: 0 },
};

const addColumnIfMissing = async (queryInterface, Sequelize, table, column) => {
  const definition = {
    type: Sequelize[COLUMNS[column].type],
    defaultValue: COLUMNS[column].defaultValue,
  };
  const tableDefinition = await queryInterface.describeTable(table);

  if (!tableDefinition[column]) {
    await queryInterface.addColumn(table, column, definition);
  }
};

const removeColumnIfExists = async (queryInterface, table, column) => {
  const tableDefinition = await queryInterface.describeTable(table);

  if (tableDefinition[column]) {
    await queryInterface.removeColumn(table, column);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, Sequelize, TABLE_NAME, 'barRevenue');
    await addColumnIfMissing(queryInterface, Sequelize, TABLE_NAME, 'psRevenue');
    await addColumnIfMissing(
      queryInterface,
      Sequelize,
      TABLE_NAME,
      'servicesRevenue',
    );

    await queryInterface.sequelize.query(`
      UPDATE ${TABLE_NAME}
      SET
        barRevenue = CASE
          WHEN COALESCE(barRevenue, 0) = 0
          THEN COALESCE(foodRevenue, 0) + COALESCE(drinksRevenue, 0) + COALESCE(chocolateRevenue, 0)
          ELSE barRevenue
        END,
        psRevenue = CASE
          WHEN COALESCE(psRevenue, 0) = 0 AND COALESCE(servicesRevenue, 0) = 0
          THEN COALESCE(psServiceRevenue, 0)
          ELSE psRevenue
        END,
        servicesRevenue = COALESCE(servicesRevenue, 0)
    `);
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, TABLE_NAME, 'servicesRevenue');
    await removeColumnIfExists(queryInterface, TABLE_NAME, 'psRevenue');
    await removeColumnIfExists(queryInterface, TABLE_NAME, 'barRevenue');
  },
};
