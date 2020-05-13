import { flattenMultiArray } from '../utilities';
import { generateWhere, joinSql, sqlArrayToEscaped } from '../sql';
import { registerBackend } from './';
import url from 'url';
// If you use Client instead of Pool every query times out ???
import { Pool as postgresClient } from 'pg';
import { countType, numberType, averageType, sumType } from '../model';

const escapeTableOrField = (name) => `"${name}"`;

const escapeField = ([table, field]) => `${escapeTableOrField(table)}.${escapeTableOrField(field)}`;

const convertField = (field) => {
  switch (field.type) {
    case 'field':
      return escapeField(field.field);

    default:
      throw new Error(`unknown field type ${field.type}`);
  }
};

const generateFields = (filter) => {
  if (filter.fields.length === 0) {
    return { fields: `${escapeTableOrField(filter.primaryModel)}.*`, groupBy: '' };
  }

  const fields = [];
  const aggregations = [];

  for (const field of filter.fields) {
    if (field.type === 'field') {
      fields.push(field);
    } else {
      aggregations.push(field);
    }
  }

  const selectFields = fields.map((field) => convertField(field));
  if (aggregations.length === 0) {
    return { fields: selectFields.join(', '), groupBy: '' };
  }

  const aggregateFields = generateAggregateField(aggregations, filter.schema);

  return {
    fields: selectFields.concat(aggregateFields).join(', '),
    groupBy: selectFields,
  };
};

const generateAggregateField = (fields, schema) =>
  fields.map((field) => {
    const escapedFieldName = escapeTableOrField(field.resultName);
    const isCountType = field.type === countType;

    if (isCountType && !field.field) {
      return `count(*) as ${escapedFieldName}`;
    }

    return `${field.type}(${escapeField(field.field)}) as ${escapedFieldName}`;
  });

const query = async (filter, connection) => {
  const { fields, groupBy } = generateFields(filter);
  const startSql = [
    'select',
    filter.distinct ? 'distinct' : '',
    fields,
    'from',
    escapeTableOrField(filter.primaryModel),
  ]
    .filter((entry) => entry != '')
    .join(' ');

  const where = generateWhere(filter.where, { escapeField });
  const wherePrefix = where.length > 0 ? ' where ' : '';

  const options = { escapeField, escapeTable: escapeTableOrField };

  const joinTable = (models, joinType) =>
    models
      .map(
        ([newModel, existingModelKey, newModelKey]) =>
          ` ${joinType} JOIN ${options.escapeTable(newModel)} ON ${options.escapeField(
            existingModelKey
          )} = ${options.escapeField(newModelKey)}`
      )
      .join('');

  const mustJoin = joinTable(filter.models, 'INNER');
  const optionalJoin = joinTable(filter.optionalModels, 'LEFT');
  const joinModels = mustJoin + optionalJoin;

  const orderSql = generateOrder(filter.order);
  const orderPrefix = orderSql.length > 0 ? ' ' : '';
  const limitSql = filter.limit >= 0 ? ` limit ${filter.limit}` : '';

  return runSql(
    joinSql([startSql, joinModels, wherePrefix, where, groupBy, orderPrefix, orderSql, limitSql]),
    filter.flat,
    connection
  );
};

const generateOrder = (order) => {
  if (order.length === 0) {
    return '';
  }

  const orderFields = order.map((entry) => `${escapeField(entry.field)} ${entry.order}`).join(', ');
  return `order by ${orderFields}`;
};

const runSql = async (sql, flat, connection) => {
  const [fullSql, values] = sqlArrayToEscaped(sql, (index) => `$${index + 1}`);

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

let isRegistered = false;
export const register = () => {
  if (isRegistered) {
    return;
  }

  isRegistered = true;

  registerBackend((urlString) => {
    const { protocol, auth, port, hostname, path } = url.parse(urlString);
    if (protocol?.toLowerCase() !== 'postgres:') {
      return;
    }

    if (hostname === null || path === null) {
      throw new Error('postgres connection string must have a host and database name');
    }

    const connection = {
      host: hostname,
      database: path.replace(/^\//, ''),
    };

    if (port !== null) {
      connection.port = port;
    }

    if (auth) {
      const [username, password] = auth.split(':');
      if (username) {
        connection.user = username;
      }

      if (password) {
        connection.password = password;
      }
    }

    const postgresConnection = new postgresClient(connection);
    return {
      query: (filter) => query(filter, postgresConnection),
      runSql: (sql, flat) => runSql(sql, flat, postgresConnection),
      end: () => postgresConnection.end(),
    };
  });
};
