'use strict';

module.exports = (sequelize, DataTypes) => {
  const ExportHistory = sequelize.define(
    'ExportHistory',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      club_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Clubs', key: 'id' },
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
      },
      report_type: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      start_date: { type: DataTypes.DATE, allowNull: true },
      end_date: { type: DataTypes.DATE, allowNull: true },
      status: {
        type: DataTypes.ENUM('pending', 'success', 'error'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_message: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'ExportHistories',
      timestamps: true,
      indexes: [
        {
          fields: ['club_id', 'createdAt'],
          name: 'export_histories_club_created_at_idx',
        },
        {
          fields: ['user_id'],
          name: 'export_histories_user_idx',
        },
      ],
    },
  );

  ExportHistory.associate = (models) => {
    ExportHistory.belongsTo(models.Club, {
      foreignKey: 'club_id',
      as: 'club',
    });
    ExportHistory.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return ExportHistory;
};
