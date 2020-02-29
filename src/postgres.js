import { flattenMultiArray } from './utilities';

/*
{
 *  fields: [{ type: <field or aggregation type>, field: [<model>, <key>]}],
 *  models: models to inner join.
 *  optionalModels: models (also in models) however need to be joined using a left join.
 *  where (optional): query if not present all fields are to be selected.
 *  order: [field: <field>, order: <asc|desc>], ...]
 *  distinct: false,
 *  flat: false,
 * }
 * */

const escapeTableOrField = name => `"${name}"`;

const escapeField = ([table, field]) => `${escapeTableOrField(table)}.${escapeTableOrField(field)}`;

const generateOrderSql = order => {
  if (order.length === 0) {
    return '';
  }

  const orderFields = order.map(entry => `${escapeField(entry.field)} ${entry.order}`).join(', ');
  return `order by ${orderFields}`;
};

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
  const sql = [
    'select',
    filter.distinct ? 'distinct' : '',
    fields,
    'from',
    escapeTableOrField(filter.primaryModel),
    generateOrderSql(filter.order),
  ]
    .filter(entry => entry != '')
    .join(' ');

  return runSql(sql, connection, filter.flat);
};

const runSql = async (sql, connection, flat) => {
  const results = await connection.query({
    rowMode: flat ? 'array' : 'objects',
    text: sql,
  });

  const isFlatAndOnlyOneField = flat && results.rows.length > 0 && results.rows[0].length === 1;
  if (isFlatAndOnlyOneField) {
    return flattenMultiArray(results.rows);
  }

  return results.rows;
};

export const postgres = {
  query,
};
