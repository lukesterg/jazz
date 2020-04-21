import { register as registerPostgres } from './backend/postgres';
import { createBackend } from './backend';
import { query } from './filter';

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

const addSchema = (schema, namespace, name = defaultDatabase) => {
  const database = getDatabaseState(name);

  if (namespace) {
    schema = Object.fromEntries(Object.entries(schema).map((entry) => [`${namespace}_${entry[0]}`, entry[1]]));
  }

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
  constructor(modelName, { schema, backend }) {
    this._schema = schema;
    this._backend = backend;
    this._query = query.start(modelName, schema);
  }

  filter(filter) {
    this._query = query.filter(filter, this._query);
    return this;
  }

  values(fields, options) {
    if (!fields) {
      return this._backend.query(this._query);
    }

    if (typeof fields === 'string') {
      fields = [fields];
    }

    const valueQuery = query.values(fields, options, this._query);
    return this._backend.query(valueQuery);
  }

  order(order, append = false) {
    if (typeof order === 'string') {
      order = [order];
    }

    this._query = query.order(order, append, this._query);
    return this;
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
