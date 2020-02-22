import { filter, filterConditions } from '../filter';
import each from 'jest-each';

test('NoOperator IsEqual', () => {
  const matches = filter({ field: 'value' });
  expect(matches.where).toEqual([{ field: ['field'], condition: 'eq', value: 'value' }]);
});

test('MultipleComparisons', () => {
  const matches = filter({ field: 'value', anotherField: 'anotherValue' });
  expect(matches.where).toEqual([
    { field: ['field'], condition: 'eq', value: 'value' },
    { field: ['anotherField'], condition: 'eq', value: 'anotherValue' },
  ]);
});

each(filterConditions).test('FieldCondition %s HasCondition', condition => {
  const matches = filter({ [`field__${condition}`]: 'value' });
  expect(matches.where).toEqual([{ field: ['field'], condition, value: 'value' }]);
});

test('JoinModel', () => {
  const matches = filter({ student__name: 'Fred' });
  expect(matches.joinModels).toEqual(['student']);
  expect(matches.where).toEqual([{ field: ['student', 'name'], condition: 'eq', value: 'Fred' }]);
});

test('JoinModel MultipleModels', () => {
  const matches = filter({ student__address__city: 'Darwin' });
  expect(matches.joinModels).toEqual(['student', 'address']);
  expect(matches.where).toEqual([{ field: ['address', 'city'], condition: 'eq', value: 'Darwin' }]);
});

test('JoinModel WithCondition', () => {
  const matches = filter({ student__age__gte: 10 });
  expect(matches.where).toEqual([{ field: ['student', 'age'], condition: 'gte', value: 10 }]);
});

test('JoinModel MultipleModels ReusingModels', () => {
  const matches = filter({ student__address__city: 'Darwin', student__age__gte: 10 });
  expect(matches.where).toEqual([
    { field: ['address', 'city'], condition: 'eq', value: 'Darwin' },
    { field: ['student', 'age'], condition: 'gte', value: 10 },
  ]);
});
