'use strict';

module.exports = (sequelize, DataTypes) => {
  const Club = sequelize.define(
    'Club',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      smartshell_id: {
        type: DataTypes.INTEGER,
        unique: true,
        allowNull: false,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      address: { type: DataTypes.STRING },
      opening_date: { type: DataTypes.DATE },
      settings: { type: DataTypes.JSON, defaultValue: {} },
    },
    {
      tableName: 'Clubs',
      timestamps: true,
    },
  );

  Club.associate = (models) => {
    Club.belongsToMany(models.User, {
      through: models.UserClub,
      foreignKey: 'club_id',
      as: 'users',
    });
  };

  return Club;
};
