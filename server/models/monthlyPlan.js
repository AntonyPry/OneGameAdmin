'use strict';

module.exports = (sequelize, DataTypes) => {
  const MonthlyPlan = sequelize.define(
    'MonthlyPlan',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      club_id: { type: DataTypes.INTEGER, allowNull: false },
      date: { type: DataTypes.STRING, allowNull: false },
      shift_type: { type: DataTypes.ENUM('day', 'night'), allowNull: false },
      totalRevenue: { type: DataTypes.INTEGER, defaultValue: 0 },
      foodRevenue: { type: DataTypes.INTEGER, defaultValue: 0 },
      chocolateRevenue: { type: DataTypes.INTEGER, defaultValue: 0 },
      drinksRevenue: { type: DataTypes.INTEGER, defaultValue: 0 },
      barRevenue: { type: DataTypes.INTEGER, defaultValue: 0 },
      psServiceRevenue: { type: DataTypes.INTEGER, defaultValue: 0 },
      psRevenue: { type: DataTypes.INTEGER, defaultValue: 0 },
      servicesRevenue: { type: DataTypes.INTEGER, defaultValue: 0 },
      pcRevenue: { type: DataTypes.INTEGER, defaultValue: 0 },
    },
    {
      tableName: 'MonthlyPlans',
      indexes: [
        {
          unique: true,
          fields: ['club_id', 'date', 'shift_type'],
          name: 'monthly_plans_club_date_shift_unique',
        },
      ],
    },
  );

  MonthlyPlan.associate = (models) => {
    MonthlyPlan.belongsTo(models.Club, { foreignKey: 'club_id' });
  };

  return MonthlyPlan;
};
