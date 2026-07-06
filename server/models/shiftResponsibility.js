'use strict';

module.exports = (sequelize, DataTypes) => {
  const ShiftResponsibility = sequelize.define(
    'ShiftResponsibility',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      club_id: { type: DataTypes.INTEGER, allowNull: false },
      shift_created_at: { type: DataTypes.STRING, allowNull: false },
      checklist: { type: DataTypes.JSON, allowNull: false },
      is_passed: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    {
      tableName: 'ShiftResponsibilities',
      indexes: [
        {
          unique: true,
          fields: ['club_id', 'shift_created_at'],
          name: 'shift_responsibilities_club_shift_unique',
        },
      ],
    },
  );

  ShiftResponsibility.associate = (models) => {
    ShiftResponsibility.belongsTo(models.Club, { foreignKey: 'club_id' });
  };

  return ShiftResponsibility;
};
