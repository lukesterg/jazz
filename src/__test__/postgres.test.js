import { defaultModels } from './constants';
import { JazzDb } from '../';
import each from 'jest-each';

const postgresConnectionString = 'postgres://test:qwerty@localhost/test';

const getDatabase = () => {
  const databaseName = Symbol();
  JazzDb.createDatabase(postgresConnectionString, databaseName);
  JazzDb.addSchema(defaultModels, databaseName);
  return JazzDb.getDatabase(databaseName);
};

test('Engine is Postgres', async () => {
  const database = getDatabase();
  expect(database.databaseType).toBe('postgres');
});

test('Raw SQL', async () => {
  const database = getDatabase();
  const name = 'Troy';
  const result = await database.sql`select name from student where name=${name} limit 1`;
  expect(result).toEqual([{ name: 'Troy' }]);
});

test('Raw SQL Flat', async () => {
  const database = getDatabase();
  const name = 'Troy';
  const result = await database.sql({ flat: true })`select name from student where name=${name} limit 1`;
  expect(result).toEqual(['Troy']);
});

test('AllRecords ReturnsAllRows UsingValues', async () => {
  const connection = getDatabase();
  const results = await connection.class.all.values();
  const names = results.map((result) => result.name);
  names.sort();
  expect(names).toEqual(['Year 3', 'Year 4', 'Year 5']);
});

test('AllRecords ReturnsAllRows UsingAsyncIterator', async () => {
  const connection = getDatabase();
  const names = [];
  for await (const record of connection.class.all) {
    names.push(record.name);
  }
  names.sort();
  expect(names).toEqual(['Year 3', 'Year 4', 'Year 5']);
});

test('Field ReturnSingleField', async () => {
  const connection = getDatabase();
  const results = await connection.class.all.order('name').values('name');
  expect(results).toEqual([{ name: 'Year 3' }, { name: 'Year 4' }, { name: 'Year 5' }]);
});

test('Field ReturnMultipleFields', async () => {
  const connection = getDatabase();
  const results = await connection.class.all.order('name').values('name', 'teacher');
  expect(results).toEqual([
    { name: 'Year 3', teacher: 'Sam' },
    { name: 'Year 4', teacher: 'Sam' },
    { name: 'Year 5', teacher: 'Sally' },
  ]);
});

test('Field ReturnSingleField Flat', async () => {
  const connection = getDatabase();
  const results = await connection.class.all.order('name').values('name', { flat: true });
  expect(results).toEqual(['Year 3', 'Year 4', 'Year 5']);
});

test('Field ReturnMultipleFields Flat', async () => {
  const connection = getDatabase();
  const results = await connection.class.all.order('name').values('name', 'teacher', { flat: true });
  expect(results).toEqual([
    ['Year 3', 'Sam'],
    ['Year 4', 'Sam'],
    ['Year 5', 'Sally'],
  ]);
});

test('Field WithDistinct', async () => {
  const connection = getDatabase();
  const results = await connection.class.all.order('teacher').values('teacher', { flat: true, distinct: true });
  expect(results).toEqual(['Sally', 'Sam']);
});

test('OrderBy Ascending', async () => {
  const connection = getDatabase();
  const results = await connection.class.all.order('name').values('name', { flat: true });
  expect(results).toEqual(['Year 3', 'Year 4', 'Year 5']);
});

test('OrderBy Descending', async () => {
  const connection = getDatabase();
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
  const connection = getDatabase();
  const [filterExpression, expectedResult] = conditionTests[testName];

  const results = await connection.class.all
    .filter(filterExpression)
    .order('funding')
    .values('funding', { flat: true });
  expect(results.map((i) => +i)).toEqual(expectedResult);
});

test('Filter Where IsNull', async () => {
  const connection = getDatabase();
  const results = await connection.class.all
    .filter({ helper__isnull: true })
    .order('name')
    .values('name', { flat: true });
  expect(results).toEqual(['Year 3', 'Year 4']);
});

test('Filter Where IsNotNull', async () => {
  const connection = getDatabase();
  const results = await connection.class.all
    .filter({ helper__isnull: false })
    .order('name')
    .values('name', { flat: true });
  expect(results).toEqual(['Year 5']);
});

test('Filter Limit', async () => {
  const connection = getDatabase();
  const results = await connection.class.all.order('name').values('name', { flat: true, limit: 1 });
  expect(results).toEqual(['Year 3']);
});

test('Single WithRecord', async () => {
  const connection = getDatabase();
  const result = await connection.class.all.filter({ helper__isnull: true }).order('name').single();
  expect(result.name).toEqual('Year 3');
});

test('Single WithoutRecord', async () => {
  const connection = getDatabase();
  const result = await connection.class.all.filter({ id: -1 }).single();
  expect(result).toBeUndefined();
});

test('RelatedField HasMany', async () => {
  const connection = getDatabase();
  const result = await connection.class.all.filter({ name: 'Year 3' }).single();
  const students = await result.students();
  const names = students.map((student) => student.name).sort();
  expect(names).toEqual(['Alison', 'Troy']);
});

test('RelatedField HasOne', async () => {
  const connection = getDatabase();
  const result = await connection.student.all.filter({ name: 'Troy' }).single();
  const studentClass = await result.class();
  expect(studentClass.name).toEqual('Year 3');
});

test('FindBy HasOneField', async () => {
  const connection = getDatabase();
  const result = await connection.student.all
    .filter({ class__name: 'Year 3' })
    .order('name')
    .values('name', { flat: true });
  expect(result).toEqual(['Alison', 'Troy']);
});

test('FindBy HasManyField', async () => {
  const connection = getDatabase();
  const result = await connection.class.all
    .filter({ students__name: 'Alison' })
    .order('name')
    .values('name', { flat: true });
  expect(result).toEqual(['Year 3']);
});

test('FindBy MultipleLevelsOfRelatedFields', async () => {
  const connection = getDatabase();
  const results = await connection.class.all
    .filter({ students__address__city: 'Moil' })
    .values('name', { flat: true, distinct: true });
  expect(results).toEqual(['Year 3']);
});

test('FindBy NotRelated', async () => {
  const connection = getDatabase();
  const results = await connection.student.all.filter({ address__isnull: true }).values('name', { flat: true });
  expect(results).toEqual(['John']);
});

test('FindBy NotRelated AndRelated', async () => {
  const connection = getDatabase();
  const results = await connection.student.all
    .filter({ address__isnull: true }, { address__city: 'Moil' })
    .values('name', { flat: true });
  expect(results).toEqual(['Troy', 'Alison', 'John']);
});

test('FindBy MultipleRelations InSameModel', async () => {
  const connection = getDatabase();
  const results = await connection.class.all
    .filter({ students__name: 'Troy', students__age: 5 })
    .values('name', { flat: true });
  expect(results).toEqual(['Year 3']);
});

test('FindBy MultipleRelations InDifferentModels', async () => {
  const connection = getDatabase();
  const results = await connection.student.all
    .filter({ class__name: 'Year 3', address__city: 'Moil' })
    .values('name', { flat: true });
  expect(results).toEqual(['Troy', 'Alison']);
});

test('FindBy RelationObject', async () => {
  const connection = getDatabase();
  const existingClass = await connection.class.all.filter({ name: 'Year 3' }).single();
  const students = await connection.student.all
    .filter({ class: existingClass })
    .order('name')
    .values('name', { flat: true });
  expect(students).toEqual(['Alison', 'Troy']);
});

test('Select RelatedField ManyToOne', async () => {
  const connection = getDatabase();
  const classesWithStudents = await connection.student.all.values('class__name', { flat: true, distinct: true });
  classesWithStudents.sort();
  expect(classesWithStudents).toEqual(['Year 3', 'Year 4']);
});

test('Select RelatedField OneToMany', async () => {
  const connection = getDatabase();
  const studentsInClasses = await connection.class.all.values('students__name', { flat: true, distinct: true });
  studentsInClasses.sort();
  // the null occurs because of an optional join. One class does not have any students.
  expect(studentsInClasses).toEqual(['Alison', 'Joe', 'John', 'Troy', null]);
});

// In this instance there is a where condition creating an inner join. The values respects the inner join.
test('Select RelatedField InnerJoinedByFilter', async () => {
  const connection = getDatabase();
  const studentsInClasses = await connection.class.all
    .filter({ students__age__lte: 10 })
    .values('students__name', { flat: true, distinct: true });
  studentsInClasses.sort();
  expect(studentsInClasses).toEqual(['Alison', 'Joe', 'John', 'Troy']);
});

test('OrderBy RelatedField', async () => {
  const connection = getDatabase();
  const classesWithStudents = await connection.class.all
    .order('students__name')
    .values('students__name', { flat: true, distinct: true });
  expect(classesWithStudents).toEqual(['Alison', 'Joe', 'John', 'Troy', null]);
});

test('OrderBy RelatedField InnerJoinedByFilter', async () => {
  const connection = getDatabase();
  const classesWithStudents = await connection.class.all
    .filter({ students__age__lte: 10 })
    .order('students__name')
    .values('students__name', { flat: true, distinct: true });
  expect(classesWithStudents).toEqual(['Alison', 'Joe', 'John', 'Troy']);
});

test('Aggregate Count AllRecords', async () => {
  const connection = getDatabase();
  const studentCount = await connection.student.all.values(JazzDb.aggregation.count());
  expect(studentCount).toEqual([{ all__count: '4' }]);
});

test('Aggregate Count Field', async () => {
  const connection = getDatabase();
  const studentCount = await connection.class.all.values(JazzDb.aggregation.count('helper'));
  expect(studentCount).toEqual([{ helper__count: '1' }]);
});

test('Aggregate Count Field WithGroupBy', async () => {
  const connection = getDatabase();
  const aggregationResult = await connection.student.all
    .order('class__name')
    .values('class__name', JazzDb.aggregation.count());

  expect(aggregationResult).toEqual([
    { name: 'Year 3', all__count: '2' },
    { name: 'Year 4', all__count: '2' },
  ]);
});

const aggregationTest = {
  min: [JazzDb.aggregation.min, 5],
  max: [JazzDb.aggregation.max, 10],
  average: [JazzDb.aggregation.average, 7.25],
  sum: [JazzDb.aggregation.sum, 29],
};
each(Object.keys(aggregationTest)).test('Aggregate %s Field', async (aggregationType) => {
  const connection = getDatabase();
  const [aggregation, expectedResult] = aggregationTest[aggregationType];
  const aggregationResult = await connection.student.all.values(aggregation('age'), { flat: true });

  // decimal values and big ints are strings
  expect(+aggregationResult[0]).toEqual(expectedResult);
});

// prettier-ignore
const aggregationWithGroupByTest = {
  min: [JazzDb.aggregation.min, [['Year 3', 5], [ 'Year 4', 8]]],
  max: [JazzDb.aggregation.max, [['Year 3', 6], [ 'Year 4', 10]]],
  average: [JazzDb.aggregation.average, [['Year 3', 5.5], [ 'Year 4', 9]]],
  sum: [JazzDb.aggregation.sum, [['Year 3', 11], [ 'Year 4', 18]]],
};
each(Object.keys(aggregationWithGroupByTest)).test('Aggregate %s Field WithGroupBy', async (aggregationType) => {
  const connection = getDatabase();
  const [aggregation, expectedResult] = aggregationWithGroupByTest[aggregationType];
  const aggregationResult = await connection.student.all
    .order('class__name')
    .values('class__name', aggregation('age'), {
      flat: true,
    });

  const aggregationResultWithNumbers = aggregationResult.map((i) => [i[0], +i[1]]);
  expect(aggregationResultWithNumbers).toEqual(expectedResult);
});

test('Aggregate Related Field', async () => {
  const connection = getDatabase();
  const aggregationResult = await connection.class.all.values('name', JazzDb.aggregation.min('students__age'), {
    flat: true,
  });

  expect(aggregationResult[0]).toEqual(['Year 3', 5]);
});

test('Aggregate Multiple Fields', async () => {
  const connection = getDatabase();
  const aggregationResult = await connection.class.all
    .filter({ name: 'Year 3' })
    .order('students__name')
    .values('name', 'students__name', JazzDb.aggregation.min('students__age'), {
      flat: true,
    });

  expect(aggregationResult).toEqual([
    ['Year 3', 'Alison', 6],
    ['Year 3', 'Troy', 5],
  ]);
});

test('Save ByInsert UpdatesPrimaryKey', async () => {
  const connection = getDatabase();
  const item = { a: 1 };
  const id = await connection.savetest1.save(item);
  expect(item.id).toBeGreaterThan(0);
  expect(id).toEqual(item.id);
});

test('Save ByInsert InsertsCorrectly', async () => {
  const connection = getDatabase();
  const expectedNumber = Math.floor(Math.random() * 1e6);
  const item = { a: expectedNumber };
  await connection.savetest1.save(item);
  const fetched = await connection.savetest1.all.filter({ id: item.id }).single();
  expect(fetched).toEqual(item);
});

each(['NoAutoPrimaryKey', 'MultipleKeys']).test('Save ByInsert %s InsertsCorrectly', async () => {
  const connection = getDatabase();
  const id = Math.floor(Math.random() * 1e6);
  const item = { id, a: 2, b: 3 };
  await connection.savetest2.save(item);
  const fetched = await connection.savetest2.all.filter({ id }).single();
  expect(fetched).toEqual(item);
});

test('Save ByUpdate UpdatesCorrectly', async () => {
  const connection = getDatabase();
  const expectedNumber = Math.floor(Math.random() * 1e6);
  const item = { a: 1 };
  await connection.savetest1.save(item);
  const insertId = item.id;
  item.a = expectedNumber;
  await connection.savetest1.save(item);
  const fetched = await connection.savetest1.all.filter({ id: item.id }).single();
  expect(fetched).toEqual(item);
  expect(insertId).toBe(item.id);
});

test('Transaction CantFetchDataInsideTransaction', async () => {
  const connection = getDatabase();
  const transaction = await connection.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  const insideTransaction = await transaction.savetest1.all.filter({ id }).single();
  const outsideTransaction = await connection.savetest1.all.filter({ id }).single();
  expect(insideTransaction).toBeDefined();
  expect(outsideTransaction).toBeUndefined();
});

test('Transaction CanCommit', async () => {
  const connection = getDatabase();
  const transaction = await connection.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.commit();
  const result = await connection.savetest1.all.filter({ id }).single();
  expect(result).toBeDefined();
});

test('Transaction CanRollback', async () => {
  const connection = getDatabase();
  const transaction = await connection.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.rollback();
  const result = await connection.savetest1.all.filter({ id }).single();
  expect(result).toBeUndefined();
});

test('Transaction Checkpoint RollbackInNestedTransaction', async () => {
  const connection = getDatabase();
  const transaction = await connection.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.checkpoint();

  const nestedId = await transaction.savetest1.save({ a: 1 });
  await transaction.rollback();
  const firstTransactionBeforeCommit = await connection.savetest1.all.filter({ id }).single();
  await transaction.commit();
  const firstTransactionAfterCommit = await connection.savetest1.all.filter({ id }).single();
  const nestedRecord = await connection.savetest1.all.filter({ id: nestedId }).single();

  expect(firstTransactionBeforeCommit).toBeUndefined();
  expect(firstTransactionAfterCommit).toBeDefined();
  expect(nestedRecord).toBeUndefined();
});

test('Transaction Checkpoint CommitInNestedTransaction', async () => {
  const connection = getDatabase();
  const transaction = await connection.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.checkpoint();
  const nestedId = await transaction.savetest1.save({ a: 1 });
  await transaction.commit();
  const firstTransactionBeforeCommit = await connection.savetest1.all.filter({ id }).single();
  await transaction.commit();
  const firstTransactionAfterCommit = await connection.savetest1.all.filter({ id }).single();
  const nestedRecord = await connection.savetest1.all.filter({ id: nestedId }).single();

  expect(firstTransactionBeforeCommit).toBeUndefined();
  expect(firstTransactionAfterCommit).toBeDefined();
  expect(nestedRecord).toBeDefined();
});

test('Transaction Checkpoint MultipleCheckpoints Commit', async () => {
  const connection = getDatabase();
  const transaction = await connection.transaction();
  await transaction.checkpoint();
  await transaction.checkpoint();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.commit();
  await transaction.commit();
  await transaction.commit();
  const record = await connection.savetest1.all.filter({ id }).single();
  expect(record).toBeDefined();
});

test('Transaction Checkpoint SeriesOfCommitsAndRollbacks', async () => {
  const connection = getDatabase();
  const transaction = await connection.transaction();
  await transaction.checkpoint();
  await transaction.checkpoint();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.commit();
  await transaction.rollback();
  await transaction.commit();
  const record = await connection.savetest1.all.filter({ id }).single();
  expect(record).toBeUndefined();
});

const transactionCompleteTests = (() => {
  const operations = {
    commit: (transaction) => transaction.commit(),
    rollback: (transaction) => transaction.rollback(),
  };

  const commands = {
    ...operations,
    sql: (transaction) => transaction.sql`select * from class`,
    query: (transaction) => transaction.savetest1.all.single(),
    checkpoint: (transaction) => transaction.checkpoint(),
  };

  const commandKeys = Object.keys(commands);
  const testNames = Object.keys(operations).reduce(
    (current, option) => current.concat(commandKeys.map((command) => [option, command])),
    []
  );

  return { testNames, operations, commands };
})();
each(transactionCompleteTests.testNames).test(
  'Transaction FinalisedTransaction By %s DoesNotAllow %s',
  async (operation, command) => {
    const connection = getDatabase();
    const transaction = await connection.transaction();
    const { operations, commands } = transactionCompleteTests;
    operations[operation](transaction);
    expect(commands[command](transaction)).rejects.toThrow();
  }
);

test('Transaction SafeWrapper CanCommit', async () => {
  const connection = getDatabase();
  let id;
  await connection.transaction(async (transaction) => {
    id = await transaction.savetest1.save({ a: 1 });
  });
  const record = await connection.savetest1.all.filter({ id }).single();
  expect(record).toBeDefined();
});

test('Transaction SafeWrapper CanReject', async () => {
  const connection = getDatabase();
  let id;
  const toThrow = new Error();
  let thrownException;

  try {
    await connection.transaction(async (transaction) => {
      id = await transaction.savetest1.save({ a: 1 });
      throw toThrow;
    });
  } catch (e) {
    thrownException = e;
  }
  const record = await connection.savetest1.all.filter({ id }).single();
  expect(record).toBeUndefined();
  expect(thrownException).toBe(toThrow);
});
