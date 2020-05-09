export const textType = 'text';
export const numberType = 'number';
export const hasOneType = 'hasOne';
export const hasManyType = 'hasMany';

export const meta = Symbol();

const defineField = (type, typeOptions, userOptions) =>
  Object.assign(
    {
      type,
      primaryKey: false,
      autoGenerated: false,
    },
    typeOptions,
    userOptions || {}
  );

export const field = {
  text: (userOptions) => defineField(textType, {}, userOptions),
  number: (userOptions) => defineField(numberType, {}, userOptions),
  hasOne: (relatedModel, userOptions) => defineField(hasOneType, { relatedModel }, userOptions),
  hasMany: (relatedModel, userOptions) => defineField(hasManyType, { relatedModel }, userOptions),
};

const defineAggregation = (type, field) => ({ type, field });

export const aggregation = {
  count: (field) => defineAggregation('count', field),
  min: (field) => defineAggregation('min', field),
  max: (field) => defineAggregation('max', field),
  average: (field) => defineAggregation('average', field),
  sum: (field) => defineAggregation('sum', field),
};

const relatedFieldTypes = [hasOneType, hasManyType];

export const isRelatedField = (field) => relatedFieldTypes.indexOf(field.type) >= 0;

const generateRelatedFieldQuery = (fieldNameName, fieldValue, result, models, queryGenerator) => {
  const { relatedModel } = fieldValue;
  if (fieldValue.type === 'hasMany') {
    return queryGenerator(relatedModel, fieldValue.relatedField, result.id);
  } else if (fieldValue.type === 'hasOne') {
    const relatedModelPrimaryKeyName = getPrimaryKeyFromModel(models[relatedModel]);
    return queryGenerator(relatedModel, relatedModelPrimaryKeyName, result[`${fieldNameName}__id`]);
  } else {
    throw new Error(`unknown field type ${fieldValue.type}`);
  }
};

export const addRelatedFieldsToResult = (modelName, result, models, queryGenerator) => {
  const relatedFields = Object.entries(models[modelName]).filter((field) => isRelatedField(field[1]));
  for (const [relatedFieldName, relatedFieldValue] of relatedFields) {
    const existingValue = result[relatedFieldName];
    if (existingValue) {
      result[`${relatedFieldName}__id`] = existingValue;
    }

    const query = generateRelatedFieldQuery(relatedFieldName, relatedFieldValue, result, models, queryGenerator);
    const single = relatedFieldValue.type === hasOneType;
    wrapForeignKey(result, relatedFieldName, query, single);
  }
};

const wrapForeignKey = (result, fieldName, query, single) => {
  let queryResult;
  let resultFetched = false;

  const get = () => {
    if (resultFetched) {
      return queryResult;
    }

    resultFetched = true;
    queryResult = single ? query.single() : query.values();
    return queryResult;
  };

  const set = (value) => {
    result = Promise.resolve(value);
    resultFetched = true;
    return value;
  };

  Object.defineProperty(result, fieldName, {
    // if we do a fetch it will be async, so we cannot use properties as would be expected.
    value: (value) => {
      if (value === undefined) {
        return get();
      }

      set(value);
      return value;
    },
    enumerable: false,
  });
};

export const getPrimaryKeyFromModel = (model) => {
  const primaryKey = Object.entries(model).find((field) => field[1].primaryKey);
  if (!primaryKey) {
    throw new Error('failed to find primary key');
  }

  return primaryKey[0];
};
