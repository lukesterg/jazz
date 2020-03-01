import { flattenMultiArray } from './utilities';
import { generateWhere, joinSql, sqlArrayToEscaped } from './sql';

const escapeTableOrField = name => `"${name}"`;

const escapeField = ([table, field]) => `${escapeTableOrField(table)}.${escapeTableOrField(field)}`;

const convertField = field => {
  switch (field.type) {
    case 'field':
      return escapeField(field.field);

    default:
      throw new Error(`unknown field type ${field.type}`);
  }
};

const query = async (filter, connection) => {
  const fields = filter.fields.length === 0 ? '*' : filter.fields.map(field => convertField(field)).join(', ');
  const startSql = [
    'select',
    filter.distinct ? 'distinct' : '',
    fields,
    'from',
    escapeTableOrField(filter.primaryModel),
  ]
    .filter(entry => entry != '')
    .join(' ');

  const where = generateWhere(filter.where, { escapeField });
  const wherePrefix = where.length > 0 ? ' where' : '';
  const endSql = generateOrder(filter.order);
  const endPrefix = endSql.length > 0 ? ' ' : '';

  return runSql(joinSql([startSql, wherePrefix, where, endPrefix, endSql]), connection, filter.flat);
};

const generateOrder = order => {
  if (order.length === 0) {
    return '';
  }

  const orderFields = order.map(entry => `${escapeField(entry.field)} ${entry.order}`).join(', ');
  return `order by ${orderFields}`;
};

const runSql = async (sql, connection, flat) => {
  const [fullSql, values] = sqlArrayToEscaped(sql, index => `$${index + 1}`);

  const results = await connection.query({
    rowMode: flat ? 'array' : 'objects',
    values,
    text: fullSql,
  });

  const isFlatAndOnlyOneField = flat && results.rows.length > 0 && results.rows[0].length === 1;
  if (isFlatAndOnlyOneField) {
    return flattenMultiArray(results.rows);
  }

  return results.rows;
};

export const postgres = {
  query,
  runSql,
};
