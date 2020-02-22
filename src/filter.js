import { getLastEntry, distinct, flattenMultiArray } from './utilities';

const equals = 'eq';
const notEquals = 'neq';
const lessThan = 'lt';
const lessThanEqual = 'lte';
const greaterThan = 'gt';
const greatThanEqual = 'gte';

export const filterConditions = [equals, notEquals, lessThan, lessThanEqual, greaterThan, greatThanEqual];
const isFilterCondition = value => filterConditions.indexOf(value) >= 0;

const simplifyFilter = (() => {
  const splitFilterKey = filterKey => filterKey.split('__');
  const filterKeyToFieldAndCondition = keys => {
    const lastEntry = getLastEntry(keys);
    let condition = equals;
    if (isFilterCondition(lastEntry)) {
      condition = keys.pop();
    }
    return {
      models: flattenMultiArray(keys.slice(0, keys.length - 1)),
      selector: {
        field: keys.slice(-2),
        condition,
      },
    };
  };

  return filter => {
    const entries = Object.entries(filter).map(([key, value]) => ({
      ...filterKeyToFieldAndCondition(splitFilterKey(key)),
      value,
    }));

    const models = distinct(flattenMultiArray(entries.map(entry => entry.models)));
    const where = entries.map(entry => ({ ...entry.selector, value: entry.value }));
    return { models, where };
  };
})();

const extendQuery = existingQuery =>
  existingQuery
    ? Object.assign({}, existingQuery)
    : {
        // selectFields: new Set(),
        joinModels: [],
        // doesNotJoinModels: new Set(),
        where: [],
        // order: [],
      };

export const filter = (filter, existingQuery) => {
  const query = extendQuery(existingQuery);
  const { models, where } = simplifyFilter(filter);
  query.where = query.where.concat(where);
  query.joinModels = distinct(query.joinModels.concat(models));
  return query;
};
