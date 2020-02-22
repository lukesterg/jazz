import { query, filterConditions } from '../filter';
import each from 'jest-each';

const defaultModels = {
  class: {},
  student: {},
  address: {},
};
const runWithJustFilter = filter => query.filter(filter, 'class', defaultModels);

test('NoRelation IncludeDefaultModelName', () => {
  const matches = runWithJustFilter({ name: 'Year 3' });
  expect(matches.models).toEqual(['class']);
});

test('NoOperator IsEqual', () => {
  const matches = runWithJustFilter({ name: 'Year 3' });
  expect(matches.where).toEqual([{ field: ['class', 'name'], condition: 'eq', value: 'Year 3' }]);
});

test('MultipleComparisons', () => {
  const matches = runWithJustFilter({ name: 'Year 3', teacher: 'Sam' });
  expect(matches.where).toEqual([
    { field: ['class', 'name'], condition: 'eq', value: 'Year 3' },
    { field: ['class', 'teacher'], condition: 'eq', value: 'Sam' },
  ]);
});

each(filterConditions).test('FieldCondition %s HasCondition', condition => {
  const matches = runWithJustFilter({ [`age__${condition}`]: 10 });
  expect(matches.where).toEqual([{ field: ['class', 'age'], condition, value: 10 }]);
});

test('JoinModel', () => {
  const matches = runWithJustFilter({ student__name: 'Fred' });
  expect(matches.models).toEqual(['class', 'student']);
  expect(matches.where).toEqual([{ field: ['student', 'name'], condition: 'eq', value: 'Fred' }]);
});

test('JoinModel MultipleModels', () => {
  const matches = runWithJustFilter({ student__address__city: 'Darwin' });
  expect(matches.models).toEqual(['class', 'student', 'address']);
  expect(matches.where).toEqual([{ field: ['address', 'city'], condition: 'eq', value: 'Darwin' }]);
});

test('JoinModel WithCondition', () => {
  const matches = runWithJustFilter({ student__age__gte: 10 });
  expect(matches.where).toEqual([{ field: ['student', 'age'], condition: 'gte', value: 10 }]);
});

test('JoinModel MultipleModels ReusingModels', () => {
  const matches = runWithJustFilter({ student__address__city: 'Darwin', student__age__gte: 10 });
  expect(matches.where).toEqual([
    { field: ['address', 'city'], condition: 'eq', value: 'Darwin' },
    { field: ['student', 'age'], condition: 'gte', value: 10 },
  ]);
});

test('CanMatch OnRelation', () => {
  const student = { pk: 3 };
  const matches = runWithJustFilter({ student });
  expect(matches.where).toEqual([{ field: ['student', 'pk'], condition: 'eq', value: 3 }]);
});

test('CanMatch NoRelation', () => {
  const matches = runWithJustFilter({ student__isnull: true });
  expect(matches.models).toEqual(['class', 'student']);
  expect(matches.optionalModels).toEqual(['student']);
  expect(matches.where).toEqual([{ field: ['student', 'pk'], condition: 'isnull', value: true }]);
});
