import { query, filterConditions } from '../filter';
import each from 'jest-each';

const defaultModels = {
  class: {
    id: { type: 'primaryKey' },
    name: {},
    teacher: {},
    funding: {},
  },
  student: {
    id: { type: 'primaryKey' },
    name: {},
    age: {},
  },
  address: {
    id: { type: 'primaryKey' },
    city: {},
  },
};
const runWithJustFilter = (filter, existingQuery) => query.filter(filter, 'class', defaultModels, existingQuery);

test('NoFilterArguments DoesNotFilter', () => {
  const filterQuery = runWithJustFilter({});
  expect(filterQuery.where).toBeUndefined();
});

test('NoRelation IncludeDefaultModelName', () => {
  const filterQuery = runWithJustFilter({ name: 'Year 3' });
  expect(filterQuery.models).toEqual(['class']);
});

test('NoOperator IsEqual', () => {
  const filterQuery = runWithJustFilter({ name: 'Year 3' });
  expect(filterQuery.where.fields).toEqual([{ field: ['class', 'name'], condition: 'eq', value: 'Year 3' }]);
});

test('MultipleComparisons', () => {
  const filterQuery = runWithJustFilter({ name: 'Year 3', teacher: 'Sam' });
  expect(filterQuery.where.fields).toEqual([
    { field: ['class', 'name'], condition: 'eq', value: 'Year 3' },
    { field: ['class', 'teacher'], condition: 'eq', value: 'Sam' },
  ]);
});

test('SingleComparison ExtendFilter WithAnotherSingleComparison', () => {
  const initialQuery = runWithJustFilter({ name: 'Year 3' });
  const filterQuery = runWithJustFilter({ teacher: 'Sam' }, initialQuery);
  expect(filterQuery.where.fields).toEqual([
    { field: ['class', 'name'], condition: 'eq', value: 'Year 3' },
    { field: ['class', 'teacher'], condition: 'eq', value: 'Sam' },
  ]);
});

const testableConditions = filterConditions.filter(i => i != 'isnull');
each(testableConditions).test('FieldCondition %s HasCondition', condition => {
  const filterQuery = runWithJustFilter({ [`funding__${condition}`]: 10 });
  expect(filterQuery.where.fields).toEqual([{ field: ['class', 'funding'], condition, value: 10 }]);
});

test('FieldCondition IsNull', () => {
  const filterQuery = runWithJustFilter({ ['funding__isnull']: true });
  expect(filterQuery.where.fields).toEqual([{ field: ['class', 'funding'], condition: 'isnull', value: true }]);
});

test('JoinModel', () => {
  const filterQuery = runWithJustFilter({ student__name: 'Fred' });
  expect(filterQuery.models).toEqual(['class', 'student']);
  expect(filterQuery.where.fields).toEqual([{ field: ['student', 'name'], condition: 'eq', value: 'Fred' }]);
});

test('JoinModel MultipleModels', () => {
  const filterQuery = runWithJustFilter({ student__address__city: 'Darwin' });
  expect(filterQuery.models).toEqual(['class', 'student', 'address']);
  expect(filterQuery.where.fields).toEqual([{ field: ['address', 'city'], condition: 'eq', value: 'Darwin' }]);
});

test('JoinModel WithCondition', () => {
  const filterQuery = runWithJustFilter({ student__age__gte: 10 });
  expect(filterQuery.where.fields).toEqual([{ field: ['student', 'age'], condition: 'gte', value: 10 }]);
});

test('JoinModel MultipleModels ReusingModels', () => {
  const filterQuery = runWithJustFilter({ student__address__city: 'Darwin', student__age__gte: 10 });
  expect(filterQuery.where.fields).toEqual([
    { field: ['address', 'city'], condition: 'eq', value: 'Darwin' },
    { field: ['student', 'age'], condition: 'gte', value: 10 },
  ]);
});

test('CanMatch OnRelation', () => {
  const student = { id: 3 };
  const filterQuery = runWithJustFilter({ student });
  expect(filterQuery.where.fields).toEqual([{ field: ['student', 'id'], condition: 'eq', value: 3 }]);
});

test('CanMatch NoRelation', () => {
  const filterQuery = runWithJustFilter({ student__isnull: true });
  expect(filterQuery.models).toEqual(['class', 'student']);
  expect(filterQuery.optionalModels).toEqual(['student']);
  expect(filterQuery.where.fields).toEqual([{ field: ['student', 'id'], condition: 'isnull', value: true }]);
});

test('CanMatch NoRelation SpecifyingPrimaryKey', () => {
  const filterQuery = runWithJustFilter({ student__id__isnull: true });
  expect(filterQuery.models).toEqual(['class', 'student']);
  expect(filterQuery.optionalModels).toEqual(['student']);
  expect(filterQuery.where.fields).toEqual([{ field: ['student', 'id'], condition: 'isnull', value: true }]);
});

test('OrCondition', () => {
  const filterQuery = runWithJustFilter([{ name: 'Year 3' }, { teacher: 'Sam' }]);
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
  const filterQuery = runWithJustFilter([{ name: 'Year 3' }, { student__name: 'Sam', student__age__gte: 10 }]);
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
  const initialQuery = runWithJustFilter([{ name: 'Year 3' }, { student__name: 'Sam', student__age__gte: 10 }]);
  const filterQuery = runWithJustFilter([{ name: 'Year 5' }, { teacher: 'Sam' }], initialQuery);

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
