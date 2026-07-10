import fs from 'node:fs';

const outDir = 'outputs/smartshell-api-audit';
const raw = JSON.parse(
  fs.readFileSync(`${outDir}/introspection-response.json`, 'utf8'),
);
const schema = raw.data.__schema;
const types = schema.types || [];
const byName = new Map(types.map((type) => [type.name, type]));

const unwrap = (type) => {
  let current = type;
  let list = false;
  let nonNull = false;

  while (current?.ofType) {
    if (current.kind === 'LIST') list = true;
    if (current.kind === 'NON_NULL') nonNull = true;
    current = current.ofType;
  }

  return {
    name: current?.name || current?.kind || '',
    kind: current?.kind || '',
    list,
    nonNull,
  };
};

const formatType = (type) => {
  const unwrapped = unwrap(type);
  return `${unwrapped.list ? '[' : ''}${unwrapped.name}${unwrapped.list ? ']' : ''}${unwrapped.nonNull ? '!' : ''}`;
};

const operationRows = (typeName) => {
  const type = byName.get(typeName);
  return (type?.fields || [])
    .map((field) => ({
      name: field.name,
      returnType: unwrap(field.type),
      returnTypeText: formatType(field.type),
      args: (field.args || []).map((arg) => ({
        name: arg.name,
        type: unwrap(arg.type),
        typeText: formatType(arg.type),
        defaultValue: arg.defaultValue,
        description: arg.description || '',
      })),
      description: field.description || '',
      deprecated: field.isDeprecated || false,
      deprecationReason: field.deprecationReason || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const queryRows = operationRows(schema.queryType.name);
const mutationRows = operationRows(schema.mutationType.name);

const categories = {
  workshift: /shift|work/i,
  revenue:
    /payment|cash|deposit|bonus|order|refund|transaction|finance|revenue|billing|pay/i,
  reports: /report|summary|stat|history|timeSeries|detailed/i,
  clients: /client|user|visitor|loyal|phone|email/i,
  bookings: /booking|reservation/i,
  hosts: /host|device|pc|computer|license|terminal/i,
  goods: /good|product|category|combo|store|warehouse|stock|quantity/i,
  tariffs: /tariff|price|grid|zone/i,
  staff: /employee|worker|admin|manager|role|permission/i,
  clubs: /club|company|network|setting/i,
  marketing: /promo|discount|achievement|task|coupon|subscription/i,
};

const grouped = Object.fromEntries(
  Object.entries(categories).map(([key, matcher]) => [
    key,
    {
      queries: queryRows.filter((operation) => matcher.test(operation.name)),
      mutations: mutationRows.filter((operation) => matcher.test(operation.name)),
    },
  ]),
);

const operationMarkdown = (title, rows) =>
  [
    `# ${title}`,
    '',
    ...rows.map((operation) => {
      const args = operation.args.length
        ? operation.args.map((arg) => `${arg.name}: ${arg.typeText}`).join(', ')
        : 'none';
      const lines = [
        `## ${operation.name}`,
        `- returns: ${operation.returnTypeText}`,
        `- args: ${args}`,
      ];
      if (operation.description) {
        lines.push(
          `- description: ${operation.description.replace(/\s+/g, ' ')}`,
        );
      }
      if (operation.deprecated) {
        lines.push(`- deprecated: ${operation.deprecationReason || 'yes'}`);
      }
      return lines.join('\n');
    }),
  ].join('\n');

const objectSummaries = types
  .filter((type) => type.kind === 'OBJECT' && !type.name.startsWith('__'))
  .map((type) => ({
    name: type.name,
    fieldCount: (type.fields || []).length,
    fields: (type.fields || []).map((field) => ({
      name: field.name,
      type: formatType(field.type),
    })),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const enumSummaries = types
  .filter((type) => type.kind === 'ENUM' && !type.name.startsWith('__'))
  .map((type) => ({
    name: type.name,
    values: (type.enumValues || []).map((value) => value.name),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const inputSummaries = types
  .filter((type) => type.kind === 'INPUT_OBJECT' && !type.name.startsWith('__'))
  .map((type) => ({
    name: type.name,
    fields: (type.inputFields || []).map((field) => ({
      name: field.name,
      type: formatType(field.type),
      defaultValue: field.defaultValue,
    })),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const compactGrouped = Object.fromEntries(
  Object.entries(grouped).map(([key, value]) => [
    key,
    {
      queries: value.queries.map((operation) => operation.name),
      mutations: value.mutations.map((operation) => operation.name),
    },
  ]),
);

fs.writeFileSync(
  `${outDir}/query-operations.json`,
  JSON.stringify(queryRows, null, 2),
);
fs.writeFileSync(
  `${outDir}/mutation-operations.json`,
  JSON.stringify(mutationRows, null, 2),
);
fs.writeFileSync(
  `${outDir}/grouped-operations.json`,
  JSON.stringify(compactGrouped, null, 2),
);
fs.writeFileSync(
  `${outDir}/object-types.json`,
  JSON.stringify(objectSummaries, null, 2),
);
fs.writeFileSync(
  `${outDir}/enum-types.json`,
  JSON.stringify(enumSummaries, null, 2),
);
fs.writeFileSync(
  `${outDir}/input-types.json`,
  JSON.stringify(inputSummaries, null, 2),
);
fs.writeFileSync(
  `${outDir}/query-operations.md`,
  operationMarkdown('Smartshell Query Operations', queryRows),
);
fs.writeFileSync(
  `${outDir}/mutation-operations.md`,
  operationMarkdown('Smartshell Mutation Operations', mutationRows),
);

console.log(
  JSON.stringify(
    {
      queries: queryRows.length,
      mutations: mutationRows.length,
      objectTypes: objectSummaries.length,
      enumTypes: enumSummaries.length,
      inputTypes: inputSummaries.length,
      groups: Object.fromEntries(
        Object.entries(compactGrouped).map(([key, value]) => [
          key,
          {
            queries: value.queries.length,
            mutations: value.mutations.length,
            queryExamples: value.queries.slice(0, 10),
            mutationExamples: value.mutations.slice(0, 10),
          },
        ]),
      ),
    },
    null,
    2,
  ),
);
