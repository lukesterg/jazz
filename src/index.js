import { register as registerPostgres } from './backend/postgres';
import { createBackend } from './backend';
import { query } from './filter';
import { addRelatedFieldsToResult } from './model';

/**
 * Database state is comprised of:
 *  backend - database backend such as postgres
 *  schema - json representation of database
 *  materialized - how the developer interfaces with the database.
 */

const defaultDatabase = Symbol('default');
let databaseState = {};

const getDatabaseState = (name) => {
  const database = databaseState[name];
  if (!database) {
    throw new Error(`database ${name} is not registered`);
  }

  return database;
};

const createDatabase = (connectionString, name = defaultDatabase) => {
  if (databaseState[name]) {
    throw new Error(`database ${name} is already registered`);
  }

  const backend = createBackend(connectionString);
  databaseState[name] = { backend, schema: {}, materialized: {} };
};

const addSchema = (schema, name = defaultDatabase) => {
  const database = getDatabaseState(name);

  const intersectingKeys = Object.keys(schema).filter((key) => database.schema[key]);
  if (intersectingKeys.length > 0) {
    throw new Error(`failed to add schema, the intersecting keys are ${intersectingKeys.join(', ')}`);
  }

  database.schema = Object.assign(database.schema, schema);
  const materializedModels = Object.fromEntries(
    Object.keys(schema).map((key) => [key, createMaterializedView(key, database)])
  );

  database.materialized = Object.assign(database.materialized, materializedModels);
};

const getDatabase = (name = defaultDatabase) => getDatabaseState(name).materialized;

const createMaterializedView = (modelName, databaseState) => ({
  all: new Query(modelName, databaseState),
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

  filter(filter) {
    return this._newFilter(query.filter(filter, this._query));
  }

  async values(fields, options) {
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

    if (!fields) {
      return await runQuery(this._query);
    }

    if (typeof fields === 'string') {
      fields = [fields];
    }

    const valueQuery = query.values(fields, options, this._query);
    return await runQuery(valueQuery);
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
};
