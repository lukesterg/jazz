import { defaultModels } from './constants';
import { JazzDb } from '../';
import each from 'jest-each';

const postgresConnectionString = 'postgres://test:qwerty@localhost/test';

const createConnection = () => {
  const databaseName = Symbol();
  JazzDb.createDatabase(postgresConnectionString, databaseName);
  JazzDb.addSchema(defaultModels, databaseName);
  return JazzDb.getDatabase(databaseName);
};

test('AllRecords ReturnsAllRows UsingValues', async () => {
  const connection = createConnection();
  const results = await connection.class.all.values();
  const names = results.map((result) => result.name);
  names.sort();
  expect(names).toEqual(['Year 3', 'Year 4', 'Year 5']);
});

test('AllRecords ReturnsAllRows UsingAsyncIterator', async () => {
  const connection = createConnection();
  const names = [];
  for await (const record of connection.class.all) {
    names.push(record.name);
  }
  names.sort();
  expect(names).toEqual(['Year 3', 'Year 4', 'Year 5']);
});

test('Field ReturnSingleField', async () => {
  const connection = createConnection();
  const results = await connection.class.all.order(['name']).values(['name']);
  expect(results).toEqual([{ name: 'Year 3' }, { name: 'Year 4' }, { name: 'Year 5' }]);
});

test('Field ReturnMultipleFields', async () => {
  const connection = createConnection();
  const results = await connection.class.all.order(['name']).values(['name', 'teacher']);
  expect(results).toEqual([
    { name: 'Year 3', teacher: 'Sam' },
    { name: 'Year 4', teacher: 'Sam' },
    { name: 'Year 5', teacher: 'Sally' },
  ]);
});

test('Field ReturnSingleField Flat', async () => {
  const connection = createConnection();
  const results = await connection.class.all.order('name').values('name', { flat: true });
  expect(results).toEqual(['Year 3', 'Year 4', 'Year 5']);
});

test('Field ReturnMultipleFields Flat', async () => {
  const connection = createConnection();
  const results = await connection.class.all.order('name').values(['name', 'teacher'], { flat: true });
  expect(results).toEqual([
    ['Year 3', 'Sam'],
    ['Year 4', 'Sam'],
    ['Year 5', 'Sally'],
  ]);
});

test('Field WithDistinct', async () => {
  const connection = createConnection();
  const results = await connection.class.all.order('teacher').values('teacher', { flat: true, distinct: true });
  expect(results).toEqual(['Sally', 'Sam']);
});

test('OrderBy Ascending', async () => {
  const connection = createConnection();
  const results = await connection.class.all.order('name').values('name', { flat: true });
  expect(results).toEqual(['Year 3', 'Year 4', 'Year 5']);
});

test('OrderBy Descending', async () => {
  const connection = createConnection();
  const results = await connection.class.all.order([['name', 'desc']]).values('name', { flat: true });
  expect(results).toEqual(['Year 5', 'Year 4', 'Year 3']);
});

const allFunds = [10, 20, 30];
const conditionTests = {
  'less than': [{ funding__lt: 20 }, allFunds.filter((i) => i < 20)],
  'less than equal to': [{ funding__lte: 20 }, allFunds.filter((i) => i <= 20)],
  'greater than': [{ funding__gt: 20 }, allFunds.filter((i) => i > 20)],
  'greater than equal to': [{ funding__gte: 20 }, allFunds.filter((i) => i >= 20)],
  'equal to': [{ funding__eq: 20 }, allFunds.filter((i) => i === 20)],
  'not equal to': [{ funding__neq: 20 }, allFunds.filter((i) => i !== 20)],
};
each(Object.keys(conditionTests)).test('Filter Where "%s"', async (testName) => {
  const connection = createConnection();
  const [filterExpression, expectedResult] = conditionTests[testName];

  const results = await connection.class.all
    .filter(filterExpression)
    .order(['funding'])
    .values(['funding'], { flat: true });
  expect(results.map((i) => +i)).toEqual(expectedResult);
});

test('Filter Where IsNull', async () => {
  const connection = createConnection();
  const results = await connection.class.all
    .filter({ helper__isnull: true })
    .order(['name'])
    .values(['name'], { flat: true });
  expect(results).toEqual(['Year 3', 'Year 4']);
});

test('Filter Where IsNotNull', async () => {
  const connection = createConnection();
  const results = await connection.class.all
    .filter({ helper__isnull: false })
    .order(['name'])
    .values(['name'], { flat: true });
  expect(results).toEqual(['Year 5']);
});

test('Filter Limit', async () => {
  const connection = createConnection();
  const results = await connection.class.all.order(['name']).values(['name'], { flat: true, limit: 1 });
  expect(results).toEqual(['Year 3']);
});

test('Single WithRecord', async () => {
  const connection = createConnection();
  const result = await connection.class.all.filter({ helper__isnull: true }).order(['name']).single();
  expect(result.name).toEqual('Year 3');
});

test('Single WithoutRecord', async () => {
  const connection = createConnection();
  const result = await connection.class.all.filter({ id: -1 }).single();
  expect(result).toBeUndefined();
});

test('RelatedField HasMany', async () => {
  const connection = createConnection();
  const result = await connection.class.all.filter({ name: 'Year 3' }).single();
  const students = await result.students();
  const names = students.map((student) => student.name).sort();
  expect(names).toEqual(['Alison', 'Troy']);
});

test('RelatedField HasOne', async () => {
  const connection = createConnection();
  const result = await connection.student.all.filter({ name: 'Troy' }).single();
  const studentClass = await result.class();
  expect(studentClass.name).toEqual('Year 3');
});
