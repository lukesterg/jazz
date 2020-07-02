import { defineNonIterableProperty, createDelayedObject, delayedObjectFlatten } from './utilities';
import scrub from 'scrub-a-dub-dub';

const relationScrubType = 'relation';
export const hasOneType = 'hasOne';
export const hasManyType = 'hasMany';

const getPrimaryKey = Symbol('get primary key');

const relationshipValidator = (validation) => {
  const { schema: fieldSchema } = validation;

  const databaseSchema = validation.local?.databaseSchema;
  if (!databaseSchema) {
    validation.next();
    return;
  }

  const isObject = typeof validation.value === 'object';
  const model = getModelByModelName(databaseSchema, fieldSchema.relatedModel);
  let scrubSchema;
  let objectFinalised;
  let runDelayedFlatten = false;

  if (isObject) {
    if (!validation.local._relationValidatedObjects) {
      validation.local._relationValidatedObjects = new Map();
    }
    const validatedObjects = validation.local._relationValidatedObjects;
    runDelayedFlatten = true;

    const existingObject = validatedObjects.get(validation.value);
    if (existingObject) {
      validation.value = existingObject.value;
      return;
    }

    const { accept: _objectFinalised, obj: delayedObject } = createDelayedObject();
    objectFinalised = _objectFinalised;
    validatedObjects.set(validation.value, delayedObject);

    scrubSchema = scrub.object(model, { onlyEnumerableItems: true });

    if (fieldSchema.relationshipType === hasManyType) {
      scrubSchema = scrub.array(scrubSchema, { optional: true });
    }
  } else {
    const relatedPrimaryKeyName = getPrimaryKeyFromModel(model);
    scrubSchema = model[relatedPrimaryKeyName];
  }

  const { success, value, errors } = scrub.validate(scrubSchema, validation.value, {
    throw: false,
    local: validation.local,
  });

  objectFinalised?.(value);
  validation.errors = errors;

  // This is used to fix cyclic validation
  if (runDelayedFlatten) {
    validation.value = delayedObjectFlatten(validation.value);
  }

  if (!success) {
    validation.next();
    return;
  }
};

export const validateRecord = (model, record, databaseSchema) => {
  const scrubSchema = scrub.object(model, { onlyEnumerableItems: true });
  return scrub.validate(scrubSchema, record, { throw: true, local: { databaseSchema } });
};

scrub.registerFieldValidator(relationshipValidator, relationScrubType);

const defineRelationship = (relationshipType, options) => ({
  optional: false,
  exists: false,
  ...options,
  relationshipType,
  types: [relationScrubType],
});

export const field = {
  primaryKey: (options) => scrub.number({ primaryKey: true, optional: true, ...options }),
  hasOne: (relatedModel, options) => defineRelationship(hasOneType, { ...options, relatedModel }),
  hasMany: (relatedModel, options) => defineRelationship(hasManyType, { optional: true, ...options, relatedModel }),
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

export const isRelatedField = (field) =>
  field.relationshipType && relatedFieldTypes.indexOf(field.relationshipType) >= 0;

const generateRelatedFieldQuery = (fieldValue, models, primaryKeyValue, existingValue, queryGenerator) => {
  const { relatedModel } = fieldValue;
  if (fieldValue.relationshipType === 'hasMany') {
    return queryGenerator(relatedModel, fieldValue.relatedField, primaryKeyValue);
  } else if (fieldValue.relationshipType === 'hasOne') {
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
    const single = relatedFieldValue.relationshipType === hasOneType;
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
      : query.get().then((result) => (typeof result === 'object' ? Object.freeze(result) : result));
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
  const hasMany = schemaEntries.filter((entry) => entry[1].relationshipType === hasManyType);
  const hasOne = schemaEntries.filter((entry) => entry[1].relationshipType === hasOneType);

  if (hasMany.length === 0 && hasOne.length === 0) {
    return record;
  }

  const recordCopy = Object.assign({}, record);
  hasMany.forEach(([key]) => {
    delete recordCopy[key];
  });
  hasOne.forEach(([key, fieldValue]) => {
    const relationValue = record[key];
    if (typeof relationValue === 'function') {
      recordCopy[key] = relationValue(getPrimaryKey);
      return;
    }

    if (relationValue) {
      recordCopy[key] = getPrimaryKeyValueFromRecord(schema, fieldValue.relatedModel, relationValue);
    }
  });

  return recordCopy;
};
