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

const simplifyFilter = (() => {
  const splitFilterKey = filterKey => filterKey.split('__');
  const isModelAField = (key, allModels) => allModels[key] !== undefined;

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

      if (isModelAField(lastEntry, allModels)) {
        keys.push('pk');
        if (value?.pk) {
          value = value.pk;
        }
      }

      keys.slice(0, keys.length - 1).forEach(model => models.add(model));
      where.push({
        field: keys.slice(-2),
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

const modelsWherePrimaryKeyIsNull = where =>
  where
    .filter(query => query.condition === 'isnull' && query.field[1] === 'pk' && query.value === true)
    .map(query => query.field[0]);

const queryFilter = (filter, modelName, allModels, existingQuery) => {
  const query = extendQuery(existingQuery);
  const { models, where } = simplifyFilter(filter, modelName, allModels);
  query.where = query.where.concat(where);
  query.models = distinct(query.models.concat(models));
  query.optionalModels = distinct([...query.optionalModels, ...modelsWherePrimaryKeyIsNull(where)]);
  return query;
};

export const query = {
  filter: queryFilter,
};
