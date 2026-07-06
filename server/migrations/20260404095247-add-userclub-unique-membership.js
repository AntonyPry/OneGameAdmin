'use strict';

const { QueryTypes } = require('sequelize');

const USER_CLUB_UNIQUE = 'user_clubs_user_club_unique';

const sameColumns = (fields, columns) => {
  const fieldNames = fields.map((field) => field.attribute || field.name);
  return (
    fieldNames.length === columns.length &&
    fieldNames.every((fieldName, index) => fieldName === columns[index])
  );
};

const hasUniqueIndex = async (queryInterface, tableName, columns, indexName) => {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some(
    (index) =>
      index.unique === true &&
      (index.name === indexName || sameColumns(index.fields || [], columns)),
  );
};

const hasNamedIndex = async (queryInterface, tableName, indexName) => {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((index) => index.name === indexName);
};

const addUniqueConstraintIfMissing = async (
  queryInterface,
  tableName,
  columns,
  constraintName,
) => {
  const exists = await hasUniqueIndex(
    queryInterface,
    tableName,
    columns,
    constraintName,
  );

  if (exists) return;

  await queryInterface.addConstraint(tableName, {
    fields: columns,
    type: 'unique',
    name: constraintName,
  });
};

const removeConstraintIfExists = async (
  queryInterface,
  tableName,
  constraintName,
) => {
  const exists = await hasNamedIndex(queryInterface, tableName, constraintName);

  if (!exists) return;
  await queryInterface.removeConstraint(tableName, constraintName);
};

const formatDuplicateRows = (rows) => {
  if (!rows.length) return null;

  const sample = rows
    .slice(0, 5)
    .map(
      (row) =>
        `user_id=${row.user_id}, club_id=${row.club_id}, ids=${row.duplicate_ids}, roles=${row.duplicate_roles}`,
    )
    .join('; ');

  return `UserClubs has duplicate user/club memberships. Resolve duplicates before adding unique constraint. Sample: ${sample}`;
};

const assertNoDuplicateUserClubs = async (sequelize) => {
  const duplicates = await sequelize.query(
    `
      SELECT
        user_id,
        club_id,
        COUNT(*) AS duplicate_count,
        GROUP_CONCAT(id ORDER BY id) AS duplicate_ids,
        GROUP_CONCAT(role ORDER BY id) AS duplicate_roles
      FROM UserClubs
      GROUP BY user_id, club_id
      HAVING COUNT(*) > 1
      LIMIT 10
    `,
    { type: QueryTypes.SELECT },
  );

  const duplicateMessage = formatDuplicateRows(duplicates);

  if (duplicateMessage) {
    throw new Error(duplicateMessage);
  }
};

module.exports = {
  async up(queryInterface) {
    await assertNoDuplicateUserClubs(queryInterface.sequelize);

    await addUniqueConstraintIfMissing(
      queryInterface,
      'UserClubs',
      ['user_id', 'club_id'],
      USER_CLUB_UNIQUE,
    );
  },

  async down(queryInterface) {
    await removeConstraintIfExists(
      queryInterface,
      'UserClubs',
      USER_CLUB_UNIQUE,
    );
  },
};
