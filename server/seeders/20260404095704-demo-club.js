// seeders/XXXXXXXXXXXXXX-demo-club.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Clubs', [
      {
        smartshell_id: 6816,
        name: 'Основной клуб',
        address: 'г. Москва, ул. Ленина, д. 1',
        opening_date: new Date('2024-12-01T00:00:00Z'),
        settings: JSON.stringify({
          motivation: {
            basePay: {
              day: 1000,
              night: 1200,
            },
            taskCompletionBonus: 1200,
            penalties: {
              longMessageResponse: {
                perCase: 300,
                escalationCount: 3,
                escalationPenalty: 1200,
              },
              uncleanClub: {
                basePenalty: 600,
                thresholdPlaces: 5,
                escalationPenalty: 1200,
              },
              dirtyKitchen: 1200,
              missedCallNoCallback: 300,
              messyWorkspace: 400,
              strangersBehindDesk: 500,
              climateControl: 200,
              fridgeNotFilled: 300,
              loudSwearingPerCase: 100,
              secretGuestFailed: 1200,
            },
            bonusRates: {
              bar: 0.05,
              services: 0.1,
              planMultiplier: 2,
            },
          },
          responsibilities: {
            items: [
              { key: 'clubCleanliness', label: 'Чистота клуба', enabled: true },
              {
                key: 'kitchenCleanliness',
                label: 'Чистота кухни',
                enabled: true,
              },
              { key: 'quickVkAnswers', label: 'Ответы ВК', enabled: true },
              {
                key: 'quickPhoneAnswers',
                label: 'Ответы телефон',
                enabled: true,
              },
              {
                key: 'workspaceCleanliness',
                label: 'Чистота рабочего места',
                enabled: true,
              },
              {
                key: 'noStrangersNearTheWorkspace',
                label: 'Посторонние за стойкой',
                enabled: true,
              },
              {
                key: 'clubClimateControl',
                label: 'Климат-контроль',
                enabled: true,
              },
              {
                key: 'refrigeratorOccupancy',
                label: 'Холодильник заполнен',
                enabled: true,
              },
              { key: 'foulLanguage', label: 'Нет мата', enabled: true },
              {
                key: 'reportsDuringDay',
                label: 'Отчеты в течение дня',
                enabled: true,
              },
            ],
          },
          smartshell: {
            companyId: 6816,
          },
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Clubs', { smartshell_id: 6816 }, {});
  },
};
