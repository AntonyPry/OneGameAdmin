'use strict';

module.exports = (sequelize, DataTypes) => {
  const UserClub = sequelize.define(
    'UserClub',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
      },
      club_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Clubs', key: 'id' },
      },
      role: {
        type: DataTypes.ENUM('owner', 'manager', 'admin'),
        allowNull: false,
        defaultValue: 'admin',
      },
    },
    {
      tableName: 'UserClubs',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'club_id'],
          name: 'user_clubs_user_club_unique',
        },
      ],
    },
  );

  return UserClub;
};
