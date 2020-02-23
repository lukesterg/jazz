/*
 * Filters allow querying models for selecting or updating.
 * The output of the filter should be in the following form:
 * {
 *  models: models to inner join.
 *  optionalModels: models (also in models) however need to be joined using a left join.
 *  where (optional): query if not present all fields are to be selected.
 *  order: [{field>: <asc|desc>}, ...]
 * }
 *
 * When where is present the field will contain conditional logic and how fields are to be looked up. Where is in the form:
 * {
 *  type: <'and' or 'or'>,
 *  fields: [ { field: [<model>, <key>], condition: <such as (eq, neq, etc.)>, value: <value> } ],
 *  innerConditions: [ ...<inner where structure if required> ],
 * }
 */

import { getLastEntry, distinct, flattenMultiArray } from './utilities';

const equals = 'eq';
const notEquals = 'neq';
const lessThan = 'lt';
const lessThanEqual = 'lte';
const greaterThan = 'gt';
const greatThanEqual = 'gte';
const isNull = 'isnull';
const ascending = 'asc';
const descending = 'desc';

const and = 'and';
const or = 'or';

export const filterConditions = [equals, notEquals, lessThan, lessThanEqual, greaterThan, greatThanEqual, isNull];
const isFilterCondition = value => filterConditions.indexOf(value.toLowerCase()) >= 0;

const getPrimaryKeyFromModel = model => {
  const primaryKey = Object.entries(model).find(field => field[1].type === 'primaryKey');
  if (!primaryKey) {
    throw new Error('failed to find primary key');
  }

  return primaryKey[0];
};

const splitFilterKey = filterKey => filterKey.split('__');

/*
 * Simplify filter converts a singular filter in to an array.
 * The field entry in the return contains the model name and the field in form [ <model name>, <field name> ].
 * Example:
 *  ({ name: 'bob', student__age: 10}, 'class', { <full model> });
 * Into:
 *  {
 *    models: [ <list of models used in query> ],
 *    where: [
 *      { field: ['class', 'bob'], condition: 'eq', value: 'bob' },
 *      { field: ['student', 'bob'], condition: 'eq', value: 'bob' },
 *    ]
 *  }
 */
const simplifyFilter = (() => {
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

const createOrExtendExpression = (type, fields, innerConditions, currentExpression) => {
  if (fields.length === 0 && innerConditions.length === 0) {
    return currentExpression;
  }

  if (!currentExpression) {
    if (fields.length === 0) {
      if (innerConditions.length === 1) {
        return innerConditions[0];
      }

      if (innerConditions.length === 0) {
        return;
      }
    }
    return { type, fields, innerConditions };
  }

  if (type === currentExpression.type) {
    return {
      type,
      fields: currentExpression.fields.concat(fields),
      innerConditions: currentExpression.innerConditions.concat(innerConditions),
    };
  }

  return {
    type,
    fields,
    innerConditions: [currentExpression].concat(innerConditions),
  };
};

const queryFilter = (filters, modelName, allModels, existingQuery) => {
  if (!Array.isArray(filters)) {
    filters = [filters];
  }

  const query = extendQuery(existingQuery);
  const whereOr = [];

  for (const filter of filters) {
    const { models, where } = simplifyFilter(filter, modelName, allModels);
    whereOr.push(where);
    query.models = distinct(query.models.concat(models));
    query.optionalModels = distinct([...query.optionalModels, ...modelsWherePrimaryKeyIsNull(where, allModels)]);
  }

  if (whereOr.length == 1) {
    query.where = createOrExtendExpression(and, whereOr[0], [], query.where);
  } else if (whereOr.length > 1) {
    const singularFields = flattenMultiArray(whereOr.filter(entry => entry.length === 1));
    const multipleFields = whereOr.filter(entry => entry.length > 1);
    const andExpressions = multipleFields.map(fields => ({ type: and, fields, innerConditions: [] }));
    const orExpression = {
      type: or,
      fields: singularFields,
      innerConditions: andExpressions,
    };
    query.where = createOrExtendExpression(and, [], [orExpression], query.where);
  }

  return query;
};

const orderMapping = {
  [ascending]: ascending,
  asc: ascending,
  [descending]: descending,
  desc: descending,
};

const getModelAndKey = (rawKey, defaultModel) => {
  const separatedKey = splitFilterKey(rawKey).slice(-2);
  return separatedKey.length === 1 ? [defaultModel, separatedKey[0]] : separatedKey;
};

const getModelAndKeyAndValidateExists = (rawKey, defaultModel, allModels) => {
  const [model, key] = getModelAndKey(rawKey, defaultModel);
  if (!allModels[model]?.[key]) {
    throw new Error(`key ${key} does not exist on model ${model}`);
  }

  return [model, key];
};

const order = (order, defaultModel, allModels, append, existingQuery) => {
  const query = extendQuery(existingQuery);

  if (!Array.isArray(order)) {
    order = [order];
  }

  const newOrder = order.map(entry => {
    if (typeof entry === 'string') {
      return { field: getModelAndKeyAndValidateExists(entry, defaultModel, allModels), order: ascending };
    }

    const [key, sortOrder] = entry;
    const normalisedSortOrder = orderMapping[sortOrder.toLowerCase()];
    if (!normalisedSortOrder) {
      throw new Error(`expected sort order of 'asc' or 'desc' but got ${sortOrder}`);
    }
    return { field: getModelAndKeyAndValidateExists(key, defaultModel, allModels), order: normalisedSortOrder };
  });

  if (append) {
    query.order = query.order.concat(newOrder);
  } else {
    query.order = newOrder;
  }

  return query;
};

export const query = {
  filter: queryFilter,
  order,
};
