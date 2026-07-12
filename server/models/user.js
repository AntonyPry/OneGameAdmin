'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: { isEmail: true },
      },
      password_hash: { type: DataTypes.STRING, allowNull: false },
      first_name: { type: DataTypes.STRING, allowNull: false },
      last_name: { type: DataTypes.STRING, allowNull: false },
      system_role: {
        type: DataTypes.ENUM('user', 'platform_admin'),
        allowNull: false,
        defaultValue: 'user',
      },
      free_trial_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'Users',
      timestamps: true,
    },
  );

  User.associate = (models) => {
    // Пользователь может иметь доступ к нескольким клубам
    User.belongsToMany(models.Club, {
      through: models.UserClub,
      foreignKey: 'user_id',
      as: 'clubs',
    });
  };

  return User;
};
