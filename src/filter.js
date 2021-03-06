/*
 * Filters allow querying models for selecting or updating.
 * The output of the filter should be in the following form:
 * {
 *  fields: [{ type: <field or aggregation type>, field: [<model>, <key>]}],
 *  models: models to inner join (including how to join them), these are stored in form [ join table, join key, related key ]
 *  optionalModels: models however need to be joined using a left join.
 *  where (optional): query if not present all fields are to be selected.
 *  limit (optional): maximum number of items to fetch.
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
import { getPrimaryKeyFromModel, hasManyType, isRelatedField, countType } from './model';

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

const splitFilterKey = (filterKey) => filterKey.split('__');

/*
 * Simplify filter converts a singular filter in to an array.
 * The field entry in the return contains the model name and the field in form [ <model name>, <field name> ].
 * Example:
 *  ({ name: 'bob', students__age: 10}, 'class', { <full model> });
 * Into:
 *  {
 *    models: [ <list of models used in query (including how to join them)> ],
 *    where: [
 *      { field: ['student', 'age'], condition: 'eq', value: 10 },
 *    ]
 *  }
 */
const simplifyFilter = (() => {
  const allowedConditionsForModel = [isNull, equals, notEquals];
  const isAllowedConditionForModel = (condition) => allowedConditionsForModel.indexOf(condition) >= 0;

  const isValidValue = (condition, value, isARelation) => {
    if (isARelation) {
      return isAllowedConditionForModel(condition);
    }

    switch (condition) {
      case isNull:
        return typeof value === 'boolean';

      default:
        return true;
    }
  };

  return (filter, { primaryModel, schema, models: existingModels, optionalModels: existingOptionalModels }) => {
    const models = new Set(existingModels.map(JSON.stringify));
    const optionalModels = new Set(existingOptionalModels.map(JSON.stringify));
    const where = [];

    for (let [flatKey, value] of Object.entries(filter)) {
      const keys = [primaryModel, ...splitFilterKey(flatKey)];

      let lastEntry = getLastEntry(keys);
      let condition = equals;
      if (isFilterCondition(lastEntry)) {
        condition = keys.pop();
      }

      const isOptionalModel = lastEntry === isNull && value === true;
      const [fieldModelName, fieldName] = getSelectedModelFromKey(
        keys,
        schema,
        isOptionalModel ? optionalModels : models
      );
      const fieldModel = schema[fieldModelName];
      const fieldSchema = fieldModel[fieldName];
      const isManyRelation = fieldSchema && fieldSchema.relationshipType === hasManyType;

      if (typeof value === 'object') {
        const primaryKeyName = getPrimaryKeyFromModel(fieldModel);
        value = value[primaryKeyName];
      }

      if (!isValidValue(condition, value, isManyRelation)) {
        throw new Error(
          `invalid value for model ${primaryModel} (condition is ${condition} and field may be ${lastEntry})`
        );
      }

      where.push({
        field: [fieldModelName, fieldName],
        condition,
        value,
      });
    }

    return { models, optionalModels, where };
  };
})();

const getSelectedModelFromKey = (keys, schema, models) => {
  let currentModel, modelName;
  const updateModel = (newModelName) => {
    currentModel = schema[newModelName];
    if (!currentModel) {
      throw new Error(`could not find the model ${newModelName} when passing a related filter`);
    }

    modelName = newModelName;
  };

  updateModel(keys[0]);
  for (const [index, key] of keys.slice(1).entries()) {
    // first item is missing because of slice
    const lastEntry = index === keys.length - 2;

    const field = currentModel[key];
    if (!field || !isRelatedField(field)) {
      if (lastEntry) {
        return [modelName, key];
      }

      throw new Error(`expected field ${key} to be a related field`);
    }

    const join =
      field.relationshipType === hasManyType
        ? [
            field.relatedModel,
            [modelName, getPrimaryKeyFromModel(currentModel)],
            [field.relatedModel, field.relatedField],
          ]
        : [
            field.relatedModel,
            [modelName, key],
            [field.relatedModel, getPrimaryKeyFromModel(schema[field.relatedModel])],
          ];

    // stringify to ensure unique joins
    models.add(JSON.stringify(join));

    updateModel(field.relatedModel);
  }

  // last entry was a related field so use the primary key
  const fieldName = getPrimaryKeyFromModel(currentModel);
  return [modelName, fieldName];
};

const extendQuery = (existingQuery) => {
  if (!existingQuery) {
    throw new Error('query not started');
  }

  return Object.assign({}, existingQuery);
};

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
    const { models, where, optionalModels } = simplifyFilter(filter, query);
    whereOr.push(where);
    query.optionalModels = [...optionalModels].map(JSON.parse);
    query.models = [...models].filter((entry) => !optionalModels.has(entry)).map(JSON.parse);
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

const order = (order, append, existingQuery) => {
  const query = extendQuery(existingQuery);

  if (!Array.isArray(order)) {
    order = [order];
  }

  const newOrder = order.map((entry) => {
    if (typeof entry === 'string') {
      return { field: entry, order: ascending };
    }

    const [key, sortOrder] = entry;
    const normalisedSortOrder = orderMapping[sortOrder.toLowerCase()];
    if (!normalisedSortOrder) {
      throw new Error(`expected sort order of 'asc' or 'desc' but got ${sortOrder}`);
    }
    return { field: key, order: normalisedSortOrder };
  });

  if (append) {
    query.order = query.order.concat(newOrder);
  } else {
    query.order = newOrder;
  }

  updateFieldsToContainFullName(query.order, query);

  return query;
};

const limit = (amount, existingQuery) => {
  const query = extendQuery(existingQuery);
  query.limit = amount;
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
  query.fields = fields.map((field) =>
    typeof field === 'string'
      ? {
          type: 'field',
          field,
        }
      : updateResultName(field)
  );
  updateFieldsToContainFullName(query.fields, query);

  return query;
};

const updateResultName = (field) => {
  if (field.resultName) {
    return field;
  }

  const copy = Object.assign({}, field);

  if (!field.field) {
    if (field.type === countType) {
      copy.resultName = 'all__count';
      return copy;
    }

    throw new Error(`${field.type} requires a field name`);
  }

  copy.resultName = `${field.field}__${field.type}`;
  return copy;
};

const updateFieldsToContainFullName = (fields, query) => {
  const relations = new Set();

  for (const field of fields) {
    if (typeof field.field !== 'string') {
      continue;
    }

    const keys = [query.primaryModel, ...splitFilterKey(field.field)];
    const [fieldModelName, fieldName] = getSelectedModelFromKey(keys, query.schema, relations);
    field.field = [fieldModelName, fieldName];
  }

  (query.models || [])
    .concat(query.optionalModels || [])
    .map(JSON.stringify)
    .filter((entry) => relations.has(entry))
    .forEach((entry) => relations.delete(entry));

  // if the model has not yet been specified add it as an optional join otherwise there will be missing records
  query.optionalModels = query.optionalModels.concat([...relations].map(JSON.parse));
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
  limit,
};
