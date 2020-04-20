import each from 'jest-each';
import { defaultModels } from './constants';
import { query } from '../filter';
import { postgres } from '../postgres';
// If you use Client instead of Pool every query times out ???
import { Pool as postgresClient } from 'pg';

const start = () => query.start('class', defaultModels);

const filterResults = (filter, existingQuery) => {
  existingQuery = existingQuery || start();
  return query.filter(filter, existingQuery);
};

const selectFields = (fields, options, existingQuery) => {
  existingQuery = existingQuery || start();
  return query.values(fields, options, existingQuery);
};

const orderResults = (order, existingQuery) => {
  existingQuery = existingQuery || start();
  return query.order(order, false, existingQuery);
};

const createConnection = () => new postgresClient();

test('AllRecords ReturnsAllRows', async () => {
  const connection = createConnection();
  const filter = filterResults({});
  const results = await postgres.query(filter, connection);
  connection.end();
  expect(results.length).toBe(3);
});

test('Field ReturnSingleField', async () => {
  const connection = createConnection();
  let filter = selectFields(['name']);
  filter = orderResults(['name'], filter);
  const results = await postgres.query(filter, connection);
  connection.end();
  expect(results).toEqual([{ name: 'Year 3' }, { name: 'Year 4' }, { name: 'Year 5' }]);
});

test('Field ReturnMultipleFields', async () => {
  const connection = createConnection();
  let filter = selectFields(['name', 'teacher']);
  filter = orderResults(['name'], filter);
  const results = await postgres.query(filter, connection);
  connection.end();
  expect(results).toEqual([
    { name: 'Year 3', teacher: 'Sam' },
    { name: 'Year 4', teacher: 'Sam' },
    { name: 'Year 5', teacher: 'Sally' },
  ]);
});

test('Field ReturnSingleField Flat', async () => {
  const connection = createConnection();
  let filter = selectFields(['name'], { flat: true });
  filter = orderResults(['name'], filter);
  const results = await postgres.query(filter, connection);
  connection.end();
  expect(results).toEqual(['Year 3', 'Year 4', 'Year 5']);
});

test('Field ReturnMultipleFields Flat', async () => {
  const connection = createConnection();
  let filter = selectFields(['name', 'teacher'], { flat: true });
  filter = orderResults(['name'], filter);
  const results = await postgres.query(filter, connection);
  connection.end();
  expect(results).toEqual([
    ['Year 3', 'Sam'],
    ['Year 4', 'Sam'],
    ['Year 5', 'Sally'],
  ]);
});

test('Field WithDistinct', async () => {
  const connection = createConnection();
  let filter = selectFields(['teacher'], { flat: true, distinct: true });
  filter = orderResults(['teacher'], filter);
  const results = await postgres.query(filter, connection);
  connection.end();
  expect(results).toEqual(['Sally', 'Sam']);
});

test('OrderBy Ascending', async () => {
  const connection = createConnection();
  let filter = selectFields(['name'], { flat: true });
  filter = orderResults(['name'], filter);
  const results = await postgres.query(filter, connection);
  connection.end();
  expect(results).toEqual(['Year 3', 'Year 4', 'Year 5']);
});

test('OrderBy Descending', async () => {
  const connection = createConnection();
  let filter = selectFields(['name'], { flat: true });
  filter = orderResults([['name', 'desc']], filter);
  const results = await postgres.query(filter, connection);
  connection.end();
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
  let filter = filterResults(filterExpression);
  filter = selectFields(['funding'], { flat: true }, filter);
  filter = orderResults(['funding'], filter);
  const results = await postgres.query(filter, connection);
  connection.end();
  expect(results.map((i) => +i)).toEqual(expectedResult);
});

test('Filter Where IsNull', async () => {
  const connection = createConnection();
  let filter = filterResults({ helper__isnull: true });
  filter = selectFields(['name'], { flat: true }, filter);
  filter = orderResults(['name'], filter);
  const results = await postgres.query(filter, connection);
  connection.end();
  expect(results).toEqual(['Year 3', 'Year 4']);
});

test('Filter Where IsNotNull', async () => {
  const connection = createConnection();
  let filter = filterResults({ helper__isnull: false });
  filter = selectFields(['name'], { flat: true }, filter);
  filter = orderResults(['name'], filter);
  const results = await postgres.query(filter, connection);
  connection.end();
  expect(results).toEqual(['Year 5']);
});
