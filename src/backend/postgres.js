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
    groupBy: selectFields.join(', '),
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
          ` ${joinType} join ${options.escapeTable(newModel)} on ${options.escapeField(
            existingModelKey
          )} = ${options.escapeField(newModelKey)}`
      )
      .join('');

  const mustJoin = joinTable(filter.models, 'inner');
  const optionalJoin = joinTable(filter.optionalModels, 'left');
  const joinModels = mustJoin + optionalJoin;

  const orderSql = generateOrder(filter.order);
  const orderPrefix = orderSql.length > 0 ? ' ' : '';
  const limitSql = filter.limit >= 0 ? ` limit ${filter.limit}` : '';

  const groupByPrefix = groupBy.length > 0 ? ' group by ' : '';

  return runSql(
    joinSql([startSql, joinModels, wherePrefix, where, groupByPrefix, groupBy, orderPrefix, orderSql, limitSql]),
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

export const transaction = async (connection, endConnection) => {
  const sql = (sql) => runSql(sql, false, connection);

  let level = 1;
  await sql('begin');

  const savePointName = () => `save_${level}`;

  const throwIfTransactionComplete = () => {
    if (level === 0) {
      throw new Error('transaction is finalised');
    }
  };

  const checkpoint = async () => {
    throwIfTransactionComplete();
    await sql('savepoint ' + savePointName());
    ++level;
  };

  const rollback = async (force) => {
    throwIfTransactionComplete();
    if (force || --level === 0) {
      level = 0;
      await sql('rollback');
      endConnection();
    } else {
      await sql('rollback to ' + savePointName());
    }
  };

  const commit = async (force) => {
    throwIfTransactionComplete();

    if (force || --level === 0) {
      level = 0;
      await sql('commit');
      endConnection();
    }
  };

  return Object.assign(
    createEngineBundleFromConnection(() => {
      throwIfTransactionComplete();
      return Promise.resolve(connection);
    }),
    { checkpoint, rollback, commit, complete: () => level === 0 }
  );
};

export const save = async (model, record, primaryKeyName, connection) => {
  const insertKeys = [];
  const insertValues = [];
  const updateKeyValues = [];

  for (const [fieldName, fieldValue] of Object.entries(record)) {
    const escapedFieldName = escapeTableOrField(fieldName);
    insertKeys.push(escapedFieldName);

    insertValues.push(insertValues.length > 0 ? ', ' : '');
    insertValues.push(fieldValue);

    const updatePrefix = updateKeyValues.length === 0 ? '' : ', ';
    updateKeyValues.push(`${updatePrefix}${escapedFieldName}=`);
    updateKeyValues.push(fieldValue);
  }

  const escapedModel = escapeTableOrField(model);
  let insert = joinSql([`insert into ${escapedModel} (${insertKeys.join(', ')}) values (`, insertValues, ')']);

  const escapedPrimaryKeyName = escapeTableOrField(primaryKeyName);
  const sql = joinSql([
    insert,
    ` on conflict(${escapedPrimaryKeyName}) do update set `,
    updateKeyValues,
    ` returning ${escapedPrimaryKeyName}`,
  ]);
  const result = await runSql(sql, true, connection);
  return result[0];
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
    return createEngineBundleFromConnection(
      () => postgresConnection.connect(),
      (connection) => connection.release()
    );
  });
};

const createEngineBundleFromConnection = (createConnection, endConnection) => ({
  name: 'postgres',
  query: async (filter) => {
    const connection = await createConnection();
    const result = await query(filter, connection);
    endConnection?.(connection);
    return result;
  },
  runSql: async (sql, flat) => {
    const connection = await createConnection();
    const result = await runSql(sql, flat, connection);
    endConnection?.(connection);
    return result;
  },
  transaction: async () => {
    const connection = await createConnection();
    return await transaction(connection, () => endConnection(connection));
  },
  save: async (model, record, primaryKeyName) => {
    const connection = await createConnection();
    const result = await save(model, record, primaryKeyName, connection);
    endConnection?.(connection);
    return result;
  },
});
