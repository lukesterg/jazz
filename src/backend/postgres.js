import { flattenMultiArray } from '../utilities';
import { generateWhereWithPrefix, joinSql, sqlArrayToEscaped } from '../sql';
import { registerBackend, displayFlat, displayCount, displayObject } from './';
import url from 'url';
// If you use Client instead of Pool every query times out ???
import { Pool as postgresClient } from 'pg';
import { countType } from '../model';

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

  const where = generateWhereWithPrefix(filter.where, { escapeField });

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
    joinSql([startSql, joinModels, where, groupByPrefix, groupBy, orderPrefix, orderSql, limitSql]),
    filter.flat ? displayFlat : displayObject,
    connection
  );
};

const deleteRecords = (filter, connection) => {
  const escapedModelName = escapeTableOrField(filter.primaryModel);
  const where = generateWhereWithPrefix(filter.where, { escapeField });
  return runSql(joinSql([`delete from ${escapedModelName}`, where]), displayCount, connection);
};

const updateRecords = (filter, updates, connection) => {
  const escapedModelName = escapeTableOrField(filter.primaryModel);
  const where = generateWhereWithPrefix(filter.where, { escapeField });
  const updateEntries = Object.entries(updates);
  if (updateEntries.length === 0) {
    return 0;
  }

  const updateFields = updateEntries.reduce((current, [field, value]) => {
    const prefix = current.length === 0 ? '' : ', ';
    const escapedField = escapeTableOrField(field);
    return current.concat(`${prefix}${escapedField}=`, value);
  }, []);

  return runSql(joinSql([`update ${escapedModelName} set `, updateFields, where]), displayCount, connection);
};

const generateOrder = (order) => {
  if (order.length === 0) {
    return '';
  }

  const orderFields = order.map((entry) => `${escapeField(entry.field)} ${entry.order}`).join(', ');
  return `order by ${orderFields}`;
};

const runSql = async (sql, display, connection) => {
  const [fullSql, values] = sqlArrayToEscaped(sql, (index) => `$${index + 1}`);
  const results = await connection.query({
    rowMode: display === displayFlat ? 'array' : 'objects',
    values,
    text: fullSql,
  });

  if (display === displayCount) {
    return results.rowCount;
  }

  const isFlatAndOnlyOneField = display === displayFlat && results.rows.length > 0 && results.rows[0].length === 1;
  if (isFlatAndOnlyOneField) {
    return flattenMultiArray(results.rows);
  }

  return results.rows;
};

export const transaction = async (connection, endConnection) => {
  const sql = (sql) => runSql(sql, displayObject, connection);
  let currentTransaction;

  let level = 1;
  await sql('begin');

  const savePointName = () => `save_${level}`;

  const throwIfTransactionComplete = () => {
    if (level === 0) {
      throw new Error('transaction is finalised');
    }
  };

  const transaction = async () => {
    throwIfTransactionComplete();
    await sql('savepoint ' + savePointName());
    ++level;
    return currentTransaction;
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

  currentTransaction = Object.assign(
    createEngineBundleFromConnection(() => {
      throwIfTransactionComplete();
      return Promise.resolve(connection);
    }),
    { transaction, rollback, commit, complete: () => level === 0 }
  );
  return currentTransaction;
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
  const result = await runSql(sql, displayFlat, connection);
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
    return Object.assign(
      createEngineBundleFromConnection(
        () => postgresConnection.connect(),
        (connection) => connection.release()
      ),
      {
        end: () => postgresConnection.end(),
      }
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
  runSql: async (sql, display) => {
    const connection = await createConnection();
    const result = await runSql(sql, display, connection);
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
  delete: async (filter) => {
    const connection = await createConnection();
    const result = await deleteRecords(filter, connection);
    endConnection?.(connection);
    return result;
  },
  update: async (filter, updates) => {
    const connection = await createConnection();
    const result = await updateRecords(filter, updates, connection);
    endConnection?.(connection);
    return result;
  },
});
