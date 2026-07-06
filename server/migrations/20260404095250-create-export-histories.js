'use strict';

const TABLE_NAME = 'ExportHistories';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      club_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Clubs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      report_type: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      start_date: { type: Sequelize.DATE, allowNull: true },
      end_date: { type: Sequelize.DATE, allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'success', 'error'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex(TABLE_NAME, ['club_id', 'createdAt'], {
      name: 'export_histories_club_created_at_idx',
    });
    await queryInterface.addIndex(TABLE_NAME, ['user_id'], {
      name: 'export_histories_user_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE_NAME);
  },
};
