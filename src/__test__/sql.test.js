import { sqlArrayToEscaped, joinSql, generateWhere } from '../sql';
import { defaultModels } from './constants';
import { query } from '../filter';

const sqlArrayEscapeWithDollarSymbol = (array) => sqlArrayToEscaped(array, (index) => `$${index + 1}`);

test('EscapedSql EmptyArray IsEmpty', () => {
  const [sql, values] = sqlArrayEscapeWithDollarSymbol([]);
  expect(sql).toBe('');
  expect(values).toEqual([]);
});

test('EscapedSql OnlySqlString', () => {
  const [sql, values] = sqlArrayEscapeWithDollarSymbol('SELECT * FROM abc');
  expect(sql).toBe('SELECT * FROM abc');
  expect(values).toEqual([]);
});

test('EscapedSql EndsWithValue', () => {
  const [sql, values] = sqlArrayEscapeWithDollarSymbol(['SELECT * FROM abc WHERE a=', 5]);
  expect(sql).toBe('SELECT * FROM abc WHERE a=$1');
  expect(values).toEqual([5]);
});

test('EscapedSql EndsWithSql', () => {
  const [sql, values] = sqlArrayEscapeWithDollarSymbol(['SELECT * FROM abc WHERE a=', 5, ' LIMIT 5']);
  expect(sql).toBe('SELECT * FROM abc WHERE a=$1 LIMIT 5');
  expect(values).toEqual([5]);
});

test('EscapedSql MultipleSqlValues', () => {
  const [sql, values] = sqlArrayEscapeWithDollarSymbol(['SELECT * FROM abc WHERE a=', 5, ' AND b=', 3]);
  expect(sql).toBe('SELECT * FROM abc WHERE a=$1 AND b=$2');
  expect(values).toEqual([5, 3]);
});

test('JoinSql String AtFront', () => {
  const sql = joinSql(['SELECT FROM abc WHERE ', ['a=', 5]]);
  expect(sql).toEqual(['SELECT FROM abc WHERE a=', 5]);
});

test('JoinSql String AtEnd', () => {
  const sql = joinSql(['SELECT FROM abc WHERE ', ['a=', 5], ' LIMIT 4']);
  expect(sql).toEqual(['SELECT FROM abc WHERE a=', 5, ' LIMIT 4']);
});

test('JoinSql String InMiddle', () => {
  const sql = joinSql(['SELECT FROM ', 'abc', ' LIMIT 4']);
  expect(sql).toEqual(['SELECT FROM abc LIMIT 4']);
});

test('JoinSql MultipleArrays', () => {
  const sql = joinSql([
    ['SELECT FROM abc WHERE a=', 3],
    [' AND b=', 4],
    [' AND c=', 9, ' AND d=', 10],
  ]);
  expect(sql).toEqual(['SELECT FROM abc WHERE a=', 3, ' AND b=', 4, ' AND c=', 9, ' AND d=', 10]);
});

const wrapWhere = (where) => generateWhere(where, { escapeField: ([table, field]) => `"${table}"."${field}"` });

const whereSimpleEqual = (expression) => {
  let filter = query.start('class', defaultModels);
  return query.filter(expression, filter).where;
};

test('GenerateWhere SingleField', () => {
  const where = whereSimpleEqual({ name: 'abc' });
  const sql = wrapWhere(where);
  expect(sql).toEqual(['"class"."name" = ', 'abc']);
});

test('GenerateWhere MultiField And', () => {
  const where = whereSimpleEqual({ name: 'abc', teacher: 'def' });
  const sql = wrapWhere(where);
  expect(sql).toEqual(['"class"."name" = ', 'abc', ' and "class"."teacher" = ', 'def']);
});

test('GenerateWhere MultiField AndOrs', () => {
  const where = whereSimpleEqual([
    { name: 'abc', teacher: 'def' },
    { name: 'ghi', teacher: 'jkl' },
  ]);
  const sql = wrapWhere(where);
  expect(sql).toEqual([
    '("class"."name" = ',
    'abc',
    ' and "class"."teacher" = ',
    'def',
    ') or ("class"."name" = ',
    'ghi',
    ' and "class"."teacher" = ',
    'jkl',
    ')',
  ]);
});
