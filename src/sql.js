/*
 * Manages generic SQL functions. In this project SQL strings (if there are no values) or arrays (which may contain values or just sql).
 * An SQL array must always begin with SQL, it is in form [sql, value 1, sql continued, value 2, etc.].
 * Therefore an SQL string will always have sql in every even position (zero initial value) and values in every odd position.
 */

const conditionToSqlCondition = {
  eq: '=',
  neq: '<>',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
};

const generateWhereField = ({ field, condition, value }, options) => {
  const conditionNormalised = condition.toLowerCase();
  const sqlCondition = conditionToSqlCondition[conditionNormalised];
  if (!sqlCondition) {
    if (conditionNormalised === 'isnull') {
      const nullOperator = value ? 'IS NULL' : 'IS NOT NULL';
      return [`${options.escapeField(field)} ${nullOperator}`];
    } else {
      throw new Error(`unknown condition ${conditionNormalised}`);
    }
  }
  return [`${options.escapeField(field)} ${sqlCondition} `, value];
};

export const generateWhere = (where, options) => {
  if (!where || where.length === 0) {
    return '';
  }

  const addOperator = (current) => (current === '' ? '' : ` ${where.type} `);
  const fields = where.fields.reduce(
    (previous, current) => joinSql([previous, addOperator(previous), generateWhereField(current, options)]),
    ''
  );

  if (where.innerConditions.length === 0) {
    return fields;
  }

  // needs to have at least 2 values (sql, value, sql continued, value2, etc.) = minimum of 4 entries
  const wrapConditionIfRequired = (existing) => (existing.length >= 4 ? joinSql(['(', existing, ')']) : existing);
  return where.innerConditions.reduce((previous, current) => {
    if (previous === '') {
      return wrapConditionIfRequired(generateWhere(current, options));
    }

    return joinSql([previous, ` ${where.type} (`, generateWhere(current, options), ')']);
  }, wrapConditionIfRequired(fields));
};

export const generateWhereWithPrefix = (where, options) => {
  const result = generateWhere(where, options);
  return result.length > 0 ? joinSql([' where ', result]) : result;
};

// Sql is in the format [query, data, query continued, data 2, etc.]
// a query will always start with sql. Sql will occur on every even entry.
export const joinSql = (entries) => {
  let result = [];
  const isLastEntrySql = () => result.length > 0 && result.length % 2 === 1;

  for (const entry of entries) {
    if (isLastEntrySql()) {
      if (typeof entry === 'string') {
        result[result.length - 1] += entry;
      } else if (entry.length > 0) {
        result[result.length - 1] += entry[0];
        result = result.concat(entry.slice(1));
      }
    } else {
      if (typeof entry === 'string') {
        result.push(entry);
      } else {
        result = result.concat(entry);
      }
    }
  }

  return result;
};

export const sqlArrayToEscaped = (array, replacement) => {
  if (typeof array === 'string') {
    return [array, []];
  }

  let sql = '';
  const values = [];
  for (let index = 0; index < array.length; ++index) {
    const entry = array[index];
    if (index % 2 === 0) {
      sql += entry;
      continue;
    }

    values.push(entry);
    sql += replacement(Math.floor(index / 2));
  }
  return [sql, values];
};
