'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Таблица Пользователей (Новая)
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      email: { type: Sequelize.STRING, unique: true, allowNull: false },
      password_hash: { type: Sequelize.STRING, allowNull: false },
      first_name: { type: Sequelize.STRING, allowNull: false },
      last_name: { type: Sequelize.STRING, allowNull: false },
      system_role: {
        type: Sequelize.ENUM('user', 'platform_admin'),
        allowNull: false,
        defaultValue: 'user',
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    // 2. Таблица Клубов (Обновленная)
    await queryInterface.createTable('Clubs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      smartshell_id: {
        type: Sequelize.INTEGER,
        unique: true,
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      address: { type: Sequelize.STRING },
      opening_date: { type: Sequelize.DATE, allowNull: true },
      settings: { type: Sequelize.JSON, defaultValue: {} },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    // 3. Связующая таблица UserClubs (Новая)
    await queryInterface.createTable('UserClubs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      club_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Clubs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('owner', 'manager', 'admin'),
        allowNull: false,
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    // 4. Обязанности по сменам (Обновлен внешний ключ)
    await queryInterface.createTable('ShiftResponsibilities', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      club_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Clubs', key: 'id' }, // Ссылаемся на новый id
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      shift_created_at: { type: Sequelize.STRING, allowNull: false },
      checklist: { type: Sequelize.JSON, allowNull: false },
      is_passed: { type: Sequelize.BOOLEAN, defaultValue: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    // 5. Месячные планы (Обновлен внешний ключ)
    await queryInterface.createTable('MonthlyPlans', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      club_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Clubs', key: 'id' }, // Ссылаемся на новый id
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      date: { type: Sequelize.STRING, allowNull: false },
      shift_type: { type: Sequelize.ENUM('day', 'night'), allowNull: false },
      totalRevenue: { type: Sequelize.INTEGER, defaultValue: 0 },
      foodRevenue: { type: Sequelize.INTEGER, defaultValue: 0 },
      chocolateRevenue: { type: Sequelize.INTEGER, defaultValue: 0 },
      drinksRevenue: { type: Sequelize.INTEGER, defaultValue: 0 },
      barRevenue: { type: Sequelize.INTEGER, defaultValue: 0 },
      psServiceRevenue: { type: Sequelize.INTEGER, defaultValue: 0 },
      psRevenue: { type: Sequelize.INTEGER, defaultValue: 0 },
      servicesRevenue: { type: Sequelize.INTEGER, defaultValue: 0 },
      pcRevenue: { type: Sequelize.INTEGER, defaultValue: 0 },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

  },

  async down(queryInterface, Sequelize) {
    // Удаляем в строгом обратном порядке, чтобы не было конфликтов внешних ключей
    await queryInterface.dropTable('MonthlyPlans');
    await queryInterface.dropTable('ShiftResponsibilities');
    await queryInterface.dropTable('UserClubs');
    await queryInterface.dropTable('Clubs');
    await queryInterface.dropTable('Users');
  },
};
