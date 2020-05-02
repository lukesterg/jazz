import { query, filterConditions } from '../filter';
import each from 'jest-each';
import { defaultModels } from './constants';

const startQuery = () => query.start('class', defaultModels);

const runFilter = (filter, existingQuery) => {
  if (!existingQuery) {
    existingQuery = startQuery();
  }

  return query.filter(filter, existingQuery);
};

test('Start SetsDefaultFields', () => {
  const query = startQuery();
  expect(query.primaryModel).toBe('class');
  expect(query.schema).toEqual(defaultModels);
});

test('NoFilterArguments DoesNotFilter', () => {
  const filterQuery = runFilter({});
  expect(filterQuery.where).toBeUndefined();
});

test('NoRelation DoesNotIncludeDefaultModelName', () => {
  const filterQuery = runFilter({ name: 'Year 3' });
  expect(filterQuery.models).toEqual([]);
});

test('NoOperator IsEqual', () => {
  const filterQuery = runFilter({ name: 'Year 3' });
  expect(filterQuery.where.fields).toEqual([{ field: ['class', 'name'], condition: 'eq', value: 'Year 3' }]);
});

test('MultipleComparisons', () => {
  const filterQuery = runFilter({ name: 'Year 3', teacher: 'Sam' });
  expect(filterQuery.where.fields).toEqual([
    { field: ['class', 'name'], condition: 'eq', value: 'Year 3' },
    { field: ['class', 'teacher'], condition: 'eq', value: 'Sam' },
  ]);
});

test('SingleComparison ExtendFilter WithAnotherSingleComparison', () => {
  const initialQuery = runFilter({ name: 'Year 3' });
  const filterQuery = runFilter({ teacher: 'Sam' }, initialQuery);
  expect(filterQuery.where.fields).toEqual([
    { field: ['class', 'name'], condition: 'eq', value: 'Year 3' },
    { field: ['class', 'teacher'], condition: 'eq', value: 'Sam' },
  ]);
});

const testableConditions = filterConditions.filter((i) => i != 'isnull');
each(testableConditions).test('FieldCondition %s HasCondition', (condition) => {
  const filterQuery = runFilter({ [`funding__${condition}`]: 10 });
  expect(filterQuery.where.fields).toEqual([{ field: ['class', 'funding'], condition, value: 10 }]);
});

test('FieldCondition IsNull', () => {
  const filterQuery = runFilter({ ['funding__isnull']: true });
  expect(filterQuery.where.fields).toEqual([{ field: ['class', 'funding'], condition: 'isnull', value: true }]);
});

test('JoinModel', () => {
  const filterQuery = runFilter({ student__name: 'Fred' });
  expect(filterQuery.models).toEqual(['student']);
  expect(filterQuery.where.fields).toEqual([{ field: ['student', 'name'], condition: 'eq', value: 'Fred' }]);
});

test('JoinModel MultipleModels', () => {
  const filterQuery = runFilter({ student__address__city: 'Darwin' });
  expect(filterQuery.models).toEqual(['student', 'address']);
  expect(filterQuery.where.fields).toEqual([{ field: ['address', 'city'], condition: 'eq', value: 'Darwin' }]);
});

test('JoinModel WithCondition', () => {
  const filterQuery = runFilter({ student__age__gte: 10 });
  expect(filterQuery.where.fields).toEqual([{ field: ['student', 'age'], condition: 'gte', value: 10 }]);
});

test('JoinModel MultipleModels ReusingModels', () => {
  const filterQuery = runFilter({ student__address__city: 'Darwin', student__age__gte: 10 });
  expect(filterQuery.where.fields).toEqual([
    { field: ['address', 'city'], condition: 'eq', value: 'Darwin' },
    { field: ['student', 'age'], condition: 'gte', value: 10 },
  ]);
});

test('CanMatch OnRelation', () => {
  const student = { id: 3 };
  const filterQuery = runFilter({ student });
  expect(filterQuery.where.fields).toEqual([{ field: ['student', 'id'], condition: 'eq', value: 3 }]);
});

test('CanMatch NoRelation', () => {
  const filterQuery = runFilter({ student__isnull: true });
  expect(filterQuery.models).toEqual([]);
  expect(filterQuery.optionalModels).toEqual(['student']);
  expect(filterQuery.where.fields).toEqual([{ field: ['student', 'id'], condition: 'isnull', value: true }]);
});

test('CanMatch NoRelation SpecifyingPrimaryKey', () => {
  const filterQuery = runFilter({ student__id__isnull: true });
  expect(filterQuery.models).toEqual([]);
  expect(filterQuery.optionalModels).toEqual(['student']);
  expect(filterQuery.where.fields).toEqual([{ field: ['student', 'id'], condition: 'isnull', value: true }]);
});

test('OrCondition', () => {
  const filterQuery = runFilter([{ name: 'Year 3' }, { teacher: 'Sam' }]);
  expect(filterQuery.where).toEqual({
    type: 'or',
    fields: [
      { field: ['class', 'name'], condition: 'eq', value: 'Year 3' },
      { field: ['class', 'teacher'], condition: 'eq', value: 'Sam' },
    ],
    innerConditions: [],
  });
});

test('OrCondition MultipleOrs OrWithAnd', () => {
  const filterQuery = runFilter([{ name: 'Year 3' }, { student__name: 'Sam', student__age__gte: 10 }]);
  expect(filterQuery.where).toEqual({
    type: 'or',
    fields: [{ field: ['class', 'name'], condition: 'eq', value: 'Year 3' }],
    innerConditions: [
      {
        type: 'and',
        fields: [
          { field: ['student', 'name'], condition: 'eq', value: 'Sam' },
          { field: ['student', 'age'], condition: 'gte', value: 10 },
        ],
        innerConditions: [],
      },
    ],
  });
});

test('OrCondition MultipleFilters BothWithOrsAndAnds', () => {
  const initialQuery = runFilter([{ name: 'Year 3' }, { student__name: 'Sam', student__age__gte: 10 }]);
  const filterQuery = runFilter([{ name: 'Year 5' }, { teacher: 'Sam' }], initialQuery);

  expect(filterQuery.where).toEqual({
    type: 'and',
    fields: [],
    innerConditions: [
      {
        type: 'or',
        fields: [{ field: ['class', 'name'], condition: 'eq', value: 'Year 3' }],
        innerConditions: [
          {
            type: 'and',
            fields: [
              { field: ['student', 'name'], condition: 'eq', value: 'Sam' },
              { field: ['student', 'age'], condition: 'gte', value: 10 },
            ],
            innerConditions: [],
          },
        ],
      },
      {
        type: 'or',
        fields: [
          { field: ['class', 'name'], condition: 'eq', value: 'Year 5' },
          { field: ['class', 'teacher'], condition: 'eq', value: 'Sam' },
        ],
        innerConditions: [],
      },
    ],
  });
});

const runOrder = (order, existingQuery, append = false) => {
  if (!existingQuery) {
    existingQuery = startQuery();
  }

  return query.order(order, append, existingQuery);
};

test('Order DefaultsToAscending', () => {
  const orderQuery = runOrder('name');
  expect(orderQuery.order).toEqual([{ field: ['class', 'name'], order: 'asc' }]);
});

test('Order MultipleOrders', () => {
  const orderQuery = runOrder(['name', 'teacher']);
  expect(orderQuery.order).toEqual([
    { field: ['class', 'name'], order: 'asc' },
    { field: ['class', 'teacher'], order: 'asc' },
  ]);
});

test('Order CanSpecifyAscending', () => {
  const orderQuery = runOrder([['name', 'asc']]);
  expect(orderQuery.order).toEqual([{ field: ['class', 'name'], order: 'asc' }]);
});

test('Order CanSpecifyDescending', () => {
  const orderQuery = runOrder([['name', 'desc']]);
  expect(orderQuery.order).toEqual([{ field: ['class', 'name'], order: 'desc' }]);
});

test('Order CanAppend', () => {
  const initialQuery = runOrder([['name', 'desc']]);
  const orderQuery = runOrder([['teacher', 'asc']], initialQuery, true);
  expect(orderQuery.order).toEqual([
    { field: ['class', 'name'], order: 'desc' },
    { field: ['class', 'teacher'], order: 'asc' },
  ]);
});

test('Order CanReplace', () => {
  const initialQuery = runOrder([['name', 'desc']]);
  const orderQuery = runOrder([['teacher', 'asc']], initialQuery, false);
  expect(orderQuery.order).toEqual([{ field: ['class', 'teacher'], order: 'asc' }]);
});

const runValues = (fields, options) => {
  const existingQuery = startQuery();
  return query.values(fields, options, existingQuery);
};

test('Value SingleValue', () => {
  const valueQuery = runValues(['name']);
  expect(valueQuery.fields).toEqual([{ type: 'field', field: ['class', 'name'] }]);
});

test('Value MultipleValues', () => {
  const valueQuery = runValues(['name']);
  expect(valueQuery.fields).toEqual([{ type: 'field', field: ['class', 'name'] }]);
});

test('Value DistinctOffByDefault', () => {
  const valueQuery = runValues(['name']);
  expect(valueQuery.distinct).toBeFalsy();
});

test('Value DistinctValues', () => {
  const valueQuery = runValues(['name'], { distinct: true });
  expect(valueQuery.distinct).toBeTruthy();
});

test('Value DistinctOffByDefault', () => {
  const valueQuery = runValues(['name']);
  expect(valueQuery.flat).toBeFalsy();
});

test('Value FlatValues', () => {
  const valueQuery = runValues(['name'], { flat: true });
  expect(valueQuery.flat).toBeTruthy();
});

test('Value FlatValuesOffByDefault', () => {
  const valueQuery = runValues(['name']);
  expect(valueQuery.flat).toBeFalsy();
});

test('Limit AddsLimit', () => {
  const filterQuery = query.limit(2, startQuery());
  expect(filterQuery.limit).toEqual(2);
});
