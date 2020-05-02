/*
 * Filters allow querying models for selecting or updating.
 * The output of the filter should be in the following form:
 * {
 *  fields: [{ type: <field or aggregation type>, field: [<model>, <key>]}],
 *  models: models to inner join.
 *  optionalModels: models (also in models) however need to be joined using a left join.
 *  where (optional): query if not present all fields are to be selected.
 *  order: [field: <field>, order: <asc|desc>], ...]
 *  distinct: false,
 *  flat: false,
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
import { hasManyType, hasOne, hasOneType } from './model';

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
const isFilterCondition = (value) => filterConditions.indexOf(value.toLowerCase()) >= 0;

const getPrimaryKeyFromModel = (model) => {
  const primaryKey = Object.entries(model).find((field) => field[1].primaryKey);
  if (!primaryKey) {
    throw new Error('failed to find primary key');
  }

  return primaryKey[0];
};

const splitFilterKey = (filterKey) => filterKey.split('__');

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
  const allowedConditionsForModel = [isNull, equals, notEquals];
  const isAllowedConditionForModel = (condition) => allowedConditionsForModel.indexOf(condition) >= 0;

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

  return (filter, { primaryModel, schema }) => {
    const models = new Set();
    const where = [];

    for (let [flatKey, value] of Object.entries(filter)) {
      const keys = [primaryModel, ...splitFilterKey(flatKey)];
      let lastEntry = getLastEntry(keys);
      let condition = equals;
      if (isFilterCondition(lastEntry)) {
        condition = keys.pop();
        lastEntry = getLastEntry(keys);
      }

      const fieldDefinition = schema[lastEntry];
      const isKeyAModel = fieldDefinition?.type === hasOneType;
      if (!isValidValue(condition, value, isKeyAModel)) {
        throw new Error(
          `invalid value for model ${primaryModel} (condition is ${condition} and field may be ${lastEntry})`
        );
      }

      if (isKeyAModel) {
        const primaryKeyName = getPrimaryKeyFromModel(fieldDefinition);

        keys.push(primaryKeyName);
        if (value?.[primaryKeyName]) {
          value = value?.[primaryKeyName];
        }
      }

      keys.slice(0, keys.length - 1).forEach((model) => models.add(model));
      const [fieldModel, fieldName] = keys.slice(-2);
      if (schema[fieldModel]?.[fieldName] === undefined) {
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

const extendQuery = (existingQuery) => {
  if (!existingQuery) {
    throw new Error('query not started');
  }

  return Object.assign({}, existingQuery);
};

const modelsWherePrimaryKeyIsNull = (where, allModels) =>
  where
    .filter(
      (query) =>
        query.condition === 'isnull' &&
        query.value === true &&
        getPrimaryKeyFromModel(allModels[query.field[0]]) === query.field[1]
    )
    .map((query) => query.field[0]);

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

const queryFilter = (filters, existingQuery) => {
  if (!Array.isArray(filters)) {
    filters = [filters];
  }

  const query = extendQuery(existingQuery);
  const whereOr = [];

  for (const filter of filters) {
    const { models, where } = simplifyFilter(filter, query);
    whereOr.push(where);
    query.optionalModels = distinct([
      ...query.optionalModels,
      ...modelsWherePrimaryKeyIsNull(where, existingQuery.schema),
    ]);
    query.models = distinct(query.models.concat(models)).filter(
      (model) => query.optionalModels.indexOf(model) < 0 && model != existingQuery.primaryModel
    );
  }

  if (whereOr.length == 1) {
    query.where = createOrExtendExpression(and, whereOr[0], [], query.where);
  } else if (whereOr.length > 1) {
    const singularFields = flattenMultiArray(whereOr.filter((entry) => entry.length === 1));
    const multipleFields = whereOr.filter((entry) => entry.length > 1);
    const andExpressions = multipleFields.map((fields) => ({ type: and, fields, innerConditions: [] }));
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

const getModelAndKey = (rawKey, query) => {
  const separatedKey = splitFilterKey(rawKey).slice(-2);
  return separatedKey.length === 1 ? [query.primaryModel, separatedKey[0]] : separatedKey;
};

const getModelAndKeyAndValidateExists = (rawKey, query) => {
  const [model, key] = getModelAndKey(rawKey, query);

  if (!query.schema[model]?.[key]) {
    throw new Error(`key ${key} does not exist on model ${model}`);
  }

  return [model, key];
};

const order = (order, append, existingQuery) => {
  const query = extendQuery(existingQuery);

  if (!Array.isArray(order)) {
    order = [order];
  }

  const newOrder = order.map((entry) => {
    if (typeof entry === 'string') {
      return { field: getModelAndKeyAndValidateExists(entry, existingQuery), order: ascending };
    }

    const [key, sortOrder] = entry;
    const normalisedSortOrder = orderMapping[sortOrder.toLowerCase()];
    if (!normalisedSortOrder) {
      throw new Error(`expected sort order of 'asc' or 'desc' but got ${sortOrder}`);
    }
    return { field: getModelAndKeyAndValidateExists(key, existingQuery), order: normalisedSortOrder };
  });

  if (append) {
    query.order = query.order.concat(newOrder);
  } else {
    query.order = newOrder;
  }

  return query;
};

const defaultValueOptions = { distinct: false, flat: false };
const values = (fields, options, existingQuery) => {
  const query = extendQuery(existingQuery);
  const completeOptions = Object.assign({}, defaultValueOptions, options);

  if (fields.length === 0 && options.flat) {
    throw new Error('can only set flat if there are fields');
  }

  query.distinct = completeOptions.distinct;
  query.flat = completeOptions.flat;
  query.fields = fields.map((field) => ({
    type: 'field',
    field: getModelAndKeyAndValidateExists(field, existingQuery),
  }));
  return query;
};

const start = (primaryModel, schema) => ({
  fields: [],
  primaryModel,
  models: [],
  optionalModels: [],
  order: [],
  distinct: false,
  flat: false,
  schema,
});

export const query = {
  start,
  filter: queryFilter,
  order,
  values,
};
