import { addSymbol, hasSymbol, defineNonIterableProperty } from './utilities';

export const textType = 'text';
export const numberType = 'number';
export const hasOneType = 'hasOne';
export const hasManyType = 'hasMany';

const fieldSymbol = Symbol('field');
const getPrimaryKey = Symbol('get primary key');

const defineField = (type, typeOptions, userOptions) => {
  const result = Object.assign(
    {
      type,
      primaryKey: false,
      autoGenerated: false,
      required: true,
    },
    typeOptions,
    userOptions || {}
  );

  return addSymbol(result, fieldSymbol);
};

/*
 * Options are:
 *  - primaryKey
 */
export const field = {
  text: (userOptions) => defineField(textType, {}, userOptions),
  number: (userOptions) => defineField(numberType, {}, userOptions),
  hasOne: (relatedModel, userOptions) => defineField(hasOneType, { relatedModel }, userOptions),
  hasMany: (relatedModel, userOptions) => defineField(hasManyType, { relatedModel }, userOptions),
};

export const aggregationSymbol = Symbol();
const defineAggregation = (type, field, options, requiresField = true) => {
  if (!field && requiresField) {
    throw new Error(`${type} requires a field`);
  }

  return Object.assign({ [aggregationSymbol]: true, type, field }, options);
};

export const countType = 'count';
export const minType = 'min';
export const maxType = 'max';
export const averageType = 'avg';
export const sumType = 'sum';

/*
 * Options are:
 *  - resultName: name of the field to add (auto generated if not specified)
 */
export const aggregation = {
  count: (field, options) => defineAggregation(countType, field, options, false),
  min: (field, options) => defineAggregation(minType, field, options),
  max: (field, options) => defineAggregation(maxType, field, options),
  average: (field, options) => defineAggregation(averageType, field, options),
  sum: (field, options) => defineAggregation(sumType, field, options),
};

const relatedFieldTypes = [hasOneType, hasManyType];

const recordFetchedFromDatabase = Symbol();
export const markRecordAsFetchedFromDatabase = (record) => addSymbol(record, recordFetchedFromDatabase);
export const wasRecordFetchedFromDatabase = (record) => hasSymbol(record, recordFetchedFromDatabase);
export const isRelatedField = (field) => relatedFieldTypes.indexOf(field.type) >= 0;

const generateRelatedFieldQuery = (fieldValue, models, primaryKeyValue, existingValue, queryGenerator) => {
  const { relatedModel } = fieldValue;
  if (fieldValue.type === 'hasMany') {
    return queryGenerator(relatedModel, fieldValue.relatedField, primaryKeyValue);
  } else if (fieldValue.type === 'hasOne') {
    const relatedModelPrimaryKeyName = getPrimaryKeyByModelName(models, relatedModel);
    return queryGenerator(relatedModel, relatedModelPrimaryKeyName, existingValue);
  } else {
    throw new Error(`unknown field type ${fieldValue.type}`);
  }
};

export const addRelatedFieldsToResult = (modelName, result, models, queryGenerator) => {
  const relatedFields = Object.entries(models[modelName]).filter((field) => isRelatedField(field[1]));
  for (const [relatedFieldName, relatedFieldValue] of relatedFields) {
    const existingValue = result[relatedFieldName];
    const primaryKeyName = getPrimaryKeyFromModel(models[modelName]);
    const primaryKeyValue = result[primaryKeyName];
    const query = generateRelatedFieldQuery(relatedFieldValue, models, primaryKeyValue, existingValue, queryGenerator);
    const single = relatedFieldValue.type === hasOneType;
    wrapForeignKey(result, relatedFieldName, query, single, single && existingValue, single && primaryKeyName);
  }
};

const wrapForeignKey = (result, fieldName, query, single, defaultPrimaryKey, primaryKeyName) => {
  let queryResult;
  let resultFetched = false;
  let primaryKey = defaultPrimaryKey;

  const get = () => {
    if (resultFetched) {
      return queryResult;
    }

    resultFetched = true;
    queryResult = single
      ? query.single()
      : query.values().then((result) => (typeof result === 'object' ? Object.freeze(result) : result));
    return queryResult;
  };

  const set = (value) => {
    result = Promise.resolve(value);
    if (primaryKeyName !== undefined) {
      primaryKey = value[primaryKeyName];
    }
    resultFetched = true;
    return value;
  };

  defineNonIterableProperty(result, fieldName, (value) => {
    if (single && value === getPrimaryKey) {
      return primaryKey;
    }

    if (value === undefined) {
      return get();
    }

    set(value);
    return value;
  });
};

export const getModelByModelName = (schema, modelName) => {
  const model = schema[modelName];
  if (!model) {
    throw new Error(`failed to find schema for ${modelName}`);
  }

  return model;
};

export const getPrimaryKeyByModelName = (schema, modelName) => {
  const model = getModelByModelName(schema, modelName);
  return getPrimaryKeyFromModel(model);
};

export const getPrimaryKeyFromModel = (model) => {
  const primaryKey = Object.entries(model).find((field) => field[1].primaryKey);
  if (!primaryKey) {
    throw new Error('failed to find primary key');
  }

  return primaryKey[0];
};

export const getPrimaryKeyValueFromRecord = (schema, modelName, record) => {
  const primaryKeyName = getPrimaryKeyByModelName(schema, modelName);
  return record[primaryKeyName];
};

export const flattenRelationshipsForSaving = (record, schema, primaryModel) => {
  const currentSchema = getModelByModelName(schema, primaryModel);
  const schemaEntries = Object.entries(currentSchema);
  const hasMany = schemaEntries.filter((entry) => entry[1].type === hasManyType);
  const hasOne = schemaEntries.filter((entry) => entry[1].type === hasOneType);

  if (hasMany.length === 0 && hasOne.length === 0) {
    return record;
  }

  const recordCopy = Object.assign({}, record);
  hasMany.forEach(([key]) => {
    delete recordCopy[key];
  });
  hasOne.forEach(([key, fieldValue]) => {
    if (wasRecordFetchedFromDatabase(recordCopy)) {
      recordCopy[key] = recordCopy[key](getPrimaryKey);
      return;
    }

    recordCopy[key] = getPrimaryKeyValueFromRecord(schema, fieldValue.relatedModel, recordCopy[key]);
  });

  return recordCopy;
};
