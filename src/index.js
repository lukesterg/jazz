import { register as registerPostgres } from './backend/postgres';
import { createBackend, displayFlat, displayObject, displayCount } from './backend';
import { query } from './filter';
import { addRelatedFieldsToResult, field, aggregation, aggregationSymbol, getPrimaryKeyFromModel } from './model';

/**
 * Database state is comprised of:
 *  backend - database backend such as postgres
 *  schema - json representation of database
 *  materialized - how the developer interfaces with the database.
 */

const defaultDatabase = Symbol('default');
let databaseState = {};

const reservedModelNames = ['sql', 'databaseType', 'transaction'];
const isReservedModelName = (name) => reservedModelNames.indexOf(name) >= 0;

const getDatabaseState = (name) => {
  const database = databaseState[name];
  if (!database) {
    throw new Error(`database ${name} is not registered`);
  }

  return database;
};

const defaultMaterializedItems = (backend) => ({
  sql: sql(backend),
  databaseType: backend.name,
});

const createDatabase = (connectionString, name = defaultDatabase) => {
  if (databaseState[name]) {
    throw new Error(`database ${name} is already registered`);
  }

  const backend = createBackend(connectionString);
  databaseState[name] = {
    backend,
    schema: {},
    materialized: Object.assign(defaultMaterializedItems(backend), {
      transaction: (callback) => createTransaction(name, backend, callback),
      end: () => backend.end(),
    }),
  };
};

const defaultSqlOptions = {
  flat: false,
  query: true,
};

const sql = (backend) => {
  const stringInterpolation = (options, strings, values) => {
    // if strings are not an array they are the new options
    if (typeof strings === 'object' && !Array.isArray(strings)) {
      return (newStrings, ...newValues) => stringInterpolation(strings, newStrings, newValues);
    }

    const sql = [strings[0]];
    for (const [index, value] of values.entries()) {
      sql.push(value);
      sql.push(strings[index + 1]);
    }

    return backend.runSql(sql, query ? (options.flat ? displayFlat : displayObject) : displayCount);
  };

  return (strings, ...values) => stringInterpolation(defaultSqlOptions, strings, values);
};

const addSchema = (schema, name = defaultDatabase) => {
  const databaseState = getDatabaseState(name);

  const intersectingKeys = Object.keys(schema).filter((key) => databaseState.schema[key]);
  if (intersectingKeys.length > 0) {
    throw new Error(`failed to add schema, the intersecting keys are ${intersectingKeys.join(', ')}`);
  }

  databaseState.schema = Object.assign(databaseState.schema, schema);
  const materializedModels = generateMaterializedView(databaseState, schema);
  databaseState.materialized = Object.assign(databaseState.materialized, materializedModels);
};

const createTransaction = async (databaseName, backend, callback) => {
  // if callback is specified we are handling the transactional safety
  if (callback) {
    const transaction = await createTransaction(databaseName, backend);
    try {
      await callback(transaction);
      transaction.commit();
    } catch (e) {
      transaction.rollback();
      throw e;
    }

    return;
  }

  const newBackend = await backend.transaction();
  const newDatabaseState = Object.assign({}, getDatabaseState(databaseName), { backend: newBackend });
  return Object.assign(defaultMaterializedItems(newBackend), generateMaterializedView(newDatabaseState), {
    checkpoint: () => newBackend.checkpoint(),
    commit: () => newBackend.commit(),
    rollback: () => newBackend.rollback(),
    complete: () => newBackend.complete(),
  });
};

const generateMaterializedView = (databaseState, schema) => {
  if (!schema) {
    schema = databaseState.schema;
  }

  return Object.fromEntries(
    Object.keys(schema).map((key) => {
      if (isReservedModelName(key)) {
        throw new Error(`unable to use ${key} as a model name as it is reserved`);
      }

      return [key, createMaterializedViewForModel(key, databaseState)];
    })
  );
};

const getDatabase = (name = defaultDatabase) => getDatabaseState(name).materialized;

const createMaterializedViewForModel = (modelName, databaseState) => ({
  all: new Query(modelName, databaseState),
  save: save(modelName, databaseState),
});

class Query {
  constructor(modelNameOrQuery, databaseState) {
    this._databaseState = databaseState;
    this._query =
      typeof modelNameOrQuery === 'string' ? query.start(modelNameOrQuery, databaseState.schema) : modelNameOrQuery;
  }

  get _schema() {
    return this._databaseState.schema;
  }

  get _backend() {
    return this._databaseState.backend;
  }

  _newFilter(query) {
    return new Query(query, this._databaseState);
  }

  filter(...filter) {
    return this._newFilter(query.filter(filter, this._query));
  }

  async delete(options) {
    let finalQuery = this._query;

    if (options?.limit > 0) {
      finalQuery = query.limit(options.limit, finalQuery);
    }

    return await this._backend.delete(finalQuery);
  }

  async values(...fields) {
    const peekLast = fields.length > 0 ? fields[fields.length - 1] : undefined;
    let options;

    if (typeof peekLast === 'object' && !peekLast[aggregationSymbol]) {
      options = fields.pop();
    }

    const runQuery = async (query) => {
      const results = await this._backend.query(query);

      if (options?.flat) {
        return results;
      }

      return results.map((result) => {
        addRelatedFieldsToResult(query.primaryModel, result, this._databaseState.schema, (model, field, value) => {
          const query = new Query(model, this._databaseState);
          return query.filter({ [field]: value });
        });
        return result;
      });
    };

    if (!options) {
      options = {};
    }

    let finalQuery = this._query;

    if (options.limit > 0) {
      finalQuery = query.limit(options.limit, finalQuery);
    }

    if (!fields) {
      return await runQuery(finalQuery);
    }

    finalQuery = query.values(fields, options, finalQuery);
    return await runQuery(finalQuery);
  }

  async single() {
    const results = await this.values({ limit: 1 });
    return results.length > 0 ? results[0] : undefined;
  }

  order(order, append = false) {
    if (typeof order === 'string') {
      order = [order];
    }

    return this._newFilter(query.order(order, append, this._query));
  }

  async *[Symbol.asyncIterator]() {
    const results = await this._backend.query(this._query);
    for (const result of results) {
      yield result;
    }
  }
}

const save = (modelName, { schema, backend }) => {
  return async (record) => {
    const primaryKey = getPrimaryKeyFromModel(schema[modelName]);
    const id = await backend.save(modelName, record, primaryKey);
    record[primaryKey] = id;
    return id;
  };
};

(() => {
  registerPostgres();

  if (process.env.DATABASE) {
    createDatabase(process.env.DATABASE);
  }
})();

export const JazzDb = {
  createDatabase,
  addSchema,
  getDatabase,
  field,
  aggregation,
};
