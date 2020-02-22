import { getLastEntry, distinct } from './utilities';

const equals = 'eq';
const notEquals = 'neq';
const lessThan = 'lt';
const lessThanEqual = 'lte';
const greaterThan = 'gt';
const greatThanEqual = 'gte';
const isNull = 'isnull';

export const filterConditions = [equals, notEquals, lessThan, lessThanEqual, greaterThan, greatThanEqual, isNull];
const isFilterCondition = value => filterConditions.indexOf(value.toLowerCase()) >= 0;

const getPrimaryKeyFromModel = model => {
  const primaryKey = Object.entries(model).find(field => field[1].type === 'primaryKey');
  if (!primaryKey) {
    throw new Error('failed to find primary key');
  }

  return primaryKey[0];
};

const simplifyFilter = (() => {
  const splitFilterKey = filterKey => filterKey.split('__');
  const isModelAField = (key, allModels) => allModels[key] !== undefined;
  const allowedConditionsForModel = [isNull, equals, notEquals];
  const isAllowedConditionForModel = condition => allowedConditionsForModel.indexOf(condition) >= 0;

  const isValidValue = (condition, value, isModel) => {
    if (isModel) {
      return isAllowedConditionForModel(condition);
    }

    switch (condition) {
      case isNull:
        return typeof value === 'boolean';

      default:
        return true;
    }
  };

  return (filter, modelName, allModels) => {
    const models = new Set();
    const where = [];

    for (const [flatKey, value] of Object.entries(filter)) {
      const keys = [modelName, ...splitFilterKey(flatKey)];
      let lastEntry = getLastEntry(keys);
      let condition = equals;
      if (isFilterCondition(lastEntry)) {
        condition = keys.pop();
        lastEntry = getLastEntry(keys);
      }

      const isKeyAModel = isModelAField(lastEntry, allModels);
      if (!isValidValue(condition, value, isKeyAModel)) {
        throw new Error(
          `invalid value for model ${modelName} (condition is ${condition} and field may be ${lastEntry})`
        );
      }

      if (isKeyAModel) {
        const primaryKeyName = getPrimaryKeyFromModel(allModels[lastEntry]);

        keys.push(primaryKeyName);
        if (value?.[primaryKeyName]) {
          value = value?.[primaryKeyName];
        }
      }

      keys.slice(0, keys.length - 1).forEach(model => models.add(model));
      const [fieldModel, fieldName] = keys.slice(-2);
      if (allModels[fieldModel]?.[fieldName] === undefined) {
        throw new Error(`could not find field ${fieldName} in model ${fieldModel}`);
      }

      where.push({
        field: [fieldModel, fieldName],
        condition,
        value,
      });
    }

    return { models: [...models], where };
  };
})();

const extendQuery = existingQuery =>
  existingQuery
    ? Object.assign({}, existingQuery)
    : {
        // selectFields: [],
        models: [],
        optionalModels: [],
        where: [],
        // order: [],
      };

const modelsWherePrimaryKeyIsNull = (where, allModels) =>
  where
    .filter(
      query =>
        query.condition === 'isnull' &&
        query.value === true &&
        getPrimaryKeyFromModel(allModels[query.field[0]]) === query.field[1]
    )
    .map(query => query.field[0]);

const queryFilter = (filter, modelName, allModels, existingQuery) => {
  const query = extendQuery(existingQuery);
  const { models, where } = simplifyFilter(filter, modelName, allModels);
  query.where = query.where.concat(where);
  query.models = distinct(query.models.concat(models));
  query.optionalModels = distinct([...query.optionalModels, ...modelsWherePrimaryKeyIsNull(where, allModels)]);
  return query;
};

export const query = {
  filter: queryFilter,
};
