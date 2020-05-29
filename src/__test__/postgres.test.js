import { defaultModels } from './constants';
import Jazz from '../';
import each from 'jest-each';
import fs from 'fs';

const getDatabase = () => {
  const databaseName = Symbol();
  Jazz.createDatabase(process.env.NODE_DATABASE, databaseName);
  Jazz.addSchema(defaultModels, databaseName);
  return Jazz.getDatabase(databaseName);
};

beforeAll(async () => {
  const database = getDatabase();
  const sql = fs.readFileSync(__dirname + '/postgres.sql', 'utf8');
  await database.sql(sql);
});

test('Engine is Postgres', async () => {
  const database = getDatabase();
  expect(database.databaseType).toBe('postgres');
  await database.end();
});

test('Raw SQL', async () => {
  const database = getDatabase();
  const name = 'Troy';
  const result = await database.sql`select name from student where name=${name} limit 1`;
  expect(result).toEqual([{ name: 'Troy' }]);
  await database.end();
});

test('Raw SQL Flat', async () => {
  const database = getDatabase();
  const name = 'Troy';
  const result = await database.sql({ flat: true })`select name from student where name=${name} limit 1`;
  expect(result).toEqual(['Troy']);
  await database.end();
});

test('AllRecords ReturnsAllRows UsingValues', async () => {
  const database = getDatabase();
  const results = await database.class.all.values();
  const names = results.map((result) => result.name);
  names.sort();
  expect(names).toEqual(['Year 3', 'Year 4', 'Year 5']);
  await database.end();
});

test('AllRecords ReturnsAllRows UsingAsyncIterator', async () => {
  const database = getDatabase();
  const names = [];
  for await (const record of database.class.all) {
    names.push(record.name);
  }
  names.sort();
  expect(names).toEqual(['Year 3', 'Year 4', 'Year 5']);
  await database.end();
});

test('Field ReturnSingleField', async () => {
  const database = getDatabase();
  const results = await database.class.all.order('name').values('name');
  expect(results).toEqual([{ name: 'Year 3' }, { name: 'Year 4' }, { name: 'Year 5' }]);
  await database.end();
});

test('Field ReturnMultipleFields', async () => {
  const database = getDatabase();
  const results = await database.class.all.order('name').values('name', 'teacher');
  expect(results).toEqual([
    { name: 'Year 3', teacher: 'Sam' },
    { name: 'Year 4', teacher: 'Sam' },
    { name: 'Year 5', teacher: 'Sally' },
  ]);
  await database.end();
});

test('Field ReturnSingleField Flat', async () => {
  const database = getDatabase();
  const results = await database.class.all.order('name').values('name', { flat: true });
  expect(results).toEqual(['Year 3', 'Year 4', 'Year 5']);
  await database.end();
});

test('Field ReturnMultipleFields Flat', async () => {
  const database = getDatabase();
  const results = await database.class.all.order('name').values('name', 'teacher', { flat: true });
  expect(results).toEqual([
    ['Year 3', 'Sam'],
    ['Year 4', 'Sam'],
    ['Year 5', 'Sally'],
  ]);
  await database.end();
});

test('Field WithDistinct', async () => {
  const database = getDatabase();
  const results = await database.class.all.order('teacher').values('teacher', { flat: true, distinct: true });
  expect(results).toEqual(['Sally', 'Sam']);
  await database.end();
});

test('OrderBy Ascending', async () => {
  const database = getDatabase();
  const results = await database.class.all.order('name').values('name', { flat: true });
  expect(results).toEqual(['Year 3', 'Year 4', 'Year 5']);
  await database.end();
});

test('OrderBy Descending', async () => {
  const database = getDatabase();
  const results = await database.class.all.order([['name', 'desc']]).values('name', { flat: true });
  expect(results).toEqual(['Year 5', 'Year 4', 'Year 3']);
  await database.end();
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
  const database = getDatabase();
  const [filterExpression, expectedResult] = conditionTests[testName];

  const results = await database.class.all.filter(filterExpression).order('funding').values('funding', { flat: true });
  expect(results.map((i) => +i)).toEqual(expectedResult);
  await database.end();
});

test('Filter Where IsNull', async () => {
  const database = getDatabase();
  const results = await database.class.all
    .filter({ helper__isnull: true })
    .order('name')
    .values('name', { flat: true });
  expect(results).toEqual(['Year 3', 'Year 4']);
  await database.end();
});

test('Filter Where IsNotNull', async () => {
  const database = getDatabase();
  const results = await database.class.all
    .filter({ helper__isnull: false })
    .order('name')
    .values('name', { flat: true });
  expect(results).toEqual(['Year 5']);
  await database.end();
});

test('Filter Limit', async () => {
  const database = getDatabase();
  const results = await database.class.all.order('name').values('name', { flat: true, limit: 1 });
  expect(results).toEqual(['Year 3']);
  await database.end();
});

test('Single WithRecord', async () => {
  const database = getDatabase();
  const result = await database.class.all.filter({ helper__isnull: true }).order('name').single();
  expect(result.name).toEqual('Year 3');
  await database.end();
});

test('Single WithoutRecord', async () => {
  const database = getDatabase();
  const result = await database.class.all.filter({ id: -1 }).single();
  expect(result).toBeUndefined();
  await database.end();
});

test('RelatedField HasMany', async () => {
  const database = getDatabase();
  const result = await database.class.all.filter({ name: 'Year 3' }).single();
  const students = await result.students();
  const names = students.map((student) => student.name).sort();
  expect(names).toEqual(['Alison', 'Troy']);
  await database.end();
});

test('RelatedField HasOne', async () => {
  const database = getDatabase();
  const result = await database.student.all.filter({ name: 'Troy' }).single();
  const studentClass = await result.class();
  expect(studentClass.name).toEqual('Year 3');
  await database.end();
});

test('FindBy HasOneField', async () => {
  const database = getDatabase();
  const result = await database.student.all
    .filter({ class__name: 'Year 3' })
    .order('name')
    .values('name', { flat: true });
  expect(result).toEqual(['Alison', 'Troy']);
  await database.end();
});

test('FindBy HasManyField', async () => {
  const database = getDatabase();
  const result = await database.class.all
    .filter({ students__name: 'Alison' })
    .order('name')
    .values('name', { flat: true });
  expect(result).toEqual(['Year 3']);
  await database.end();
});

test('FindBy MultipleLevelsOfRelatedFields', async () => {
  const database = getDatabase();
  const results = await database.class.all
    .filter({ students__address__city: 'Moil' })
    .values('name', { flat: true, distinct: true });
  expect(results).toEqual(['Year 3']);
  await database.end();
});

test('FindBy NotRelated', async () => {
  const database = getDatabase();
  const results = await database.student.all.filter({ address__isnull: true }).values('name', { flat: true });
  expect(results).toEqual(['John']);
  await database.end();
});

test('FindBy NotRelated AndRelated', async () => {
  const database = getDatabase();
  const results = await database.student.all
    .filter({ address__isnull: true }, { address__city: 'Moil' })
    .values('name', { flat: true });
  expect(results).toEqual(['Troy', 'Alison', 'John']);
  await database.end();
});

test('FindBy MultipleRelations InSameModel', async () => {
  const database = getDatabase();
  const results = await database.class.all
    .filter({ students__name: 'Troy', students__age: 5 })
    .values('name', { flat: true });
  expect(results).toEqual(['Year 3']);
  await database.end();
});

test('FindBy MultipleRelations InDifferentModels', async () => {
  const database = getDatabase();
  const results = await database.student.all
    .filter({ class__name: 'Year 3', address__city: 'Moil' })
    .values('name', { flat: true });
  expect(results).toEqual(['Troy', 'Alison']);
  await database.end();
});

test('FindBy RelationObject', async () => {
  const database = getDatabase();
  const existingClass = await database.class.all.filter({ name: 'Year 3' }).single();
  const students = await database.student.all
    .filter({ class: existingClass })
    .order('name')
    .values('name', { flat: true });
  expect(students).toEqual(['Alison', 'Troy']);
  await database.end();
});

test('Select RelatedField ManyToOne', async () => {
  const database = getDatabase();
  const classesWithStudents = await database.student.all.values('class__name', { flat: true, distinct: true });
  classesWithStudents.sort();
  expect(classesWithStudents).toEqual(['Year 3', 'Year 4']);
  await database.end();
});

test('Select RelatedField OneToMany', async () => {
  const database = getDatabase();
  const studentsInClasses = await database.class.all.values('students__name', { flat: true, distinct: true });
  studentsInClasses.sort();
  // the null occurs because of an optional join. One class does not have any students.
  expect(studentsInClasses).toEqual(['Alison', 'Joe', 'John', 'Troy', null]);
  await database.end();
});

// In this instance there is a where condition creating an inner join. The values respects the inner join.
test('Select RelatedField InnerJoinedByFilter', async () => {
  const database = getDatabase();
  const studentsInClasses = await database.class.all
    .filter({ students__age__lte: 10 })
    .values('students__name', { flat: true, distinct: true });
  studentsInClasses.sort();
  expect(studentsInClasses).toEqual(['Alison', 'Joe', 'John', 'Troy']);
  await database.end();
});

test('OrderBy RelatedField', async () => {
  const database = getDatabase();
  const classesWithStudents = await database.class.all
    .order('students__name')
    .values('students__name', { flat: true, distinct: true });
  expect(classesWithStudents).toEqual(['Alison', 'Joe', 'John', 'Troy', null]);
  await database.end();
});

test('OrderBy RelatedField InnerJoinedByFilter', async () => {
  const database = getDatabase();
  const classesWithStudents = await database.class.all
    .filter({ students__age__lte: 10 })
    .order('students__name')
    .values('students__name', { flat: true, distinct: true });
  expect(classesWithStudents).toEqual(['Alison', 'Joe', 'John', 'Troy']);
  await database.end();
});

test('Aggregate Count AllRecords', async () => {
  const database = getDatabase();
  const studentCount = await database.student.all.values(Jazz.aggregation.count());
  expect(studentCount).toEqual([{ all__count: '4' }]);
  await database.end();
});

test('Aggregate Count Field', async () => {
  const database = getDatabase();
  const studentCount = await database.class.all.values(Jazz.aggregation.count('helper'));
  expect(studentCount).toEqual([{ helper__count: '1' }]);
  await database.end();
});

test('Aggregate Count Field WithGroupBy', async () => {
  const database = getDatabase();
  const aggregationResult = await database.student.all
    .order('class__name')
    .values('class__name', Jazz.aggregation.count());

  expect(aggregationResult).toEqual([
    { name: 'Year 3', all__count: '2' },
    { name: 'Year 4', all__count: '2' },
  ]);
  await database.end();
});

const aggregationTest = {
  min: [Jazz.aggregation.min, 5],
  max: [Jazz.aggregation.max, 10],
  average: [Jazz.aggregation.average, 7.25],
  sum: [Jazz.aggregation.sum, 29],
};
each(Object.keys(aggregationTest)).test('Aggregate %s Field', async (aggregationType) => {
  const database = getDatabase();
  const [aggregation, expectedResult] = aggregationTest[aggregationType];
  const aggregationResult = await database.student.all.values(aggregation('age'), { flat: true });

  // decimal values and big ints are strings
  expect(+aggregationResult[0]).toEqual(expectedResult);
  await database.end();
});

// prettier-ignore
const aggregationWithGroupByTest = {
  min: [Jazz.aggregation.min, [['Year 3', 5], [ 'Year 4', 8]]],
  max: [Jazz.aggregation.max, [['Year 3', 6], [ 'Year 4', 10]]],
  average: [Jazz.aggregation.average, [['Year 3', 5.5], [ 'Year 4', 9]]],
  sum: [Jazz.aggregation.sum, [['Year 3', 11], [ 'Year 4', 18]]],
};
each(Object.keys(aggregationWithGroupByTest)).test('Aggregate %s Field WithGroupBy', async (aggregationType) => {
  const database = getDatabase();
  const [aggregation, expectedResult] = aggregationWithGroupByTest[aggregationType];
  const aggregationResult = await database.student.all.order('class__name').values('class__name', aggregation('age'), {
    flat: true,
  });

  const aggregationResultWithNumbers = aggregationResult.map((i) => [i[0], +i[1]]);
  expect(aggregationResultWithNumbers).toEqual(expectedResult);
  await database.end();
});

test('Aggregate Related Field', async () => {
  const database = getDatabase();
  const aggregationResult = await database.class.all.values('name', Jazz.aggregation.min('students__age'), {
    flat: true,
  });

  expect(aggregationResult[0]).toEqual(['Year 3', 5]);
  await database.end();
});

test('Aggregate Multiple Fields', async () => {
  const database = getDatabase();
  const aggregationResult = await database.class.all
    .filter({ name: 'Year 3' })
    .order('students__name')
    .values('name', 'students__name', Jazz.aggregation.min('students__age'), {
      flat: true,
    });

  expect(aggregationResult).toEqual([
    ['Year 3', 'Alison', 6],
    ['Year 3', 'Troy', 5],
  ]);
  await database.end();
});

test('Save ByInsert UpdatesPrimaryKey', async () => {
  const database = getDatabase();
  const item = await database.savetest1.save({ a: 1 });
  expect(item.id).toBeGreaterThan(0);
  await database.end();
});

test('Save ByInsert InsertsCorrectly', async () => {
  const database = getDatabase();
  const expectedNumber = Math.floor(Math.random() * 1e6);
  const item = { a: expectedNumber };
  await database.savetest1.save(item);
  const fetched = await database.savetest1.all.filter({ id: item.id }).single();
  expect(fetched).toEqual(item);
  await database.end();
});

each(['NoAutoPrimaryKey', 'MultipleKeys']).test('Save ByInsert %s InsertsCorrectly', async () => {
  const database = getDatabase();
  const id = Math.floor(Math.random() * 1e6);
  const item = { id, a: 2, b: 3 };
  await database.savetest2.save(item);
  const fetched = await database.savetest2.all.filter({ id }).single();
  expect(fetched).toEqual(item);
  await database.end();
});

test('Save ByUpdate UpdatesCorrectly', async () => {
  const database = getDatabase();
  const expectedNumber = Math.floor(Math.random() * 1e6);
  const item = { a: 1 };
  await database.savetest1.save(item);
  item.a = expectedNumber;
  await database.savetest1.save(item);
  const fetched = await database.savetest1.all.filter({ id: item.id }).single();
  expect(fetched).toEqual(item);
  await database.end();
});

test('Save Relation HasOne', async () => {
  const database = getDatabase();
  const record = { name: 'Fred' };
  await database.savetest3_author.save(record);
  const fetched = await database.savetest3_author.all.filter({ id: record.id }).single();
  expect(fetched).toEqual(record);
  await database.end();
});

test('Save Relation HasMany Update WithNoRelationChange', async () => {
  const database = getDatabase();
  const author = await database.savetest3_author.save({ name: 'Fred' });
  await database.savetest3_author.save(author);
  const fetchedAuthor = await database.savetest3_author.all.filter({ id: author.id }).single();
  fetchedAuthor.name = 'Bob';
  await database.savetest3_author.save(fetchedAuthor);
  const fetchedAuthorAfterUpdate = await database.savetest3_author.all.filter({ id: author.id }).single();
  expect(fetchedAuthor).toEqual(fetchedAuthorAfterUpdate);
  await database.end();
});

test('Save Relation HasMany', async () => {
  const database = getDatabase();
  const author = await database.savetest3_author.save({ name: 'Alice' });
  const book = await database.savetest3_book.save({
    name: 'The big book',
    author,
  });

  const fetchedAuthor = await database.savetest3_author.all.filter({ id: author.id }).single();
  const fetchedBooks = await fetchedAuthor.books();
  delete book.author;
  expect(fetchedBooks).toEqual([book]);
  await database.end();
});

test('Save Relation HasOne Update WithNoRelationChange', async () => {
  const database = getDatabase();
  const author = await database.savetest3_author.save({ name: 'Fred' });
  await database.savetest3_author.save(author);
  const book = await database.savetest3_book.save({ name: 'Little Book', author });
  await database.savetest3_book.save(book);
  const fetchedBook = await database.savetest3_book.all.filter({ id: book.id }).single();
  fetchedBook.name = 'Little Book 2';
  await database.savetest3_book.save(fetchedBook);
  const fetchedBookAfterUpdate = await database.savetest3_book.all.filter({ id: book.id }).single();
  expect(fetchedBook).toEqual(fetchedBookAfterUpdate);
  await database.end();
});

test('Save Relation HasOne Update WithRelationChange', async () => {
  const database = getDatabase();
  const originalAuthor = await database.savetest3_author.save({ name: 'Fred' });
  await database.savetest3_author.save(originalAuthor);
  const book = await database.savetest3_book.save({ name: 'Little Book', author: originalAuthor });
  await database.savetest3_book.save(book);
  const fetchedBook = await database.savetest3_book.all.filter({ id: book.id }).single();
  const newAuthor = await database.savetest3_author.save({ name: 'Susan' });
  fetchedBook.author(newAuthor);
  await database.savetest3_book.save(fetchedBook);
  const fetchedBookAfterUpdate = await database.savetest3_book.all.filter({ id: book.id }).single();
  const newAuthorFetch = await fetchedBookAfterUpdate.author();
  expect(newAuthorFetch).toEqual(newAuthor);
  await database.end();
});

test('Transaction CantFetchDataInsideTransaction', async () => {
  const database = getDatabase();
  const transaction = await database.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  const insideTransaction = await transaction.savetest1.all.filter({ id }).single();
  const outsideTransaction = await database.savetest1.all.filter({ id }).single();
  transaction.rollback();
  expect(insideTransaction).toBeDefined();
  expect(outsideTransaction).toBeUndefined();
  await database.end();
});

test('Transaction CanCommit', async () => {
  const database = getDatabase();
  const transaction = await database.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.commit();
  const result = await database.savetest1.all.filter({ id }).single();
  expect(result).toBeDefined();
  await database.end();
});

test('Transaction CanRollback', async () => {
  const database = getDatabase();
  const transaction = await database.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.rollback();
  const result = await database.savetest1.all.filter({ id }).single();
  expect(result).toBeUndefined();
  await database.end();
});

test('Transaction transaction RollbackInNestedTransaction', async () => {
  const database = getDatabase();
  const transaction = await database.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.transaction();

  const nestedId = await transaction.savetest1.save({ a: 1 });
  await transaction.rollback();
  const firstTransactionBeforeCommit = await database.savetest1.all.filter({ id }).single();
  await transaction.commit();
  const firstTransactionAfterCommit = await database.savetest1.all.filter({ id }).single();
  const nestedRecord = await database.savetest1.all.filter({ id: nestedId }).single();

  expect(firstTransactionBeforeCommit).toBeUndefined();
  expect(firstTransactionAfterCommit).toBeDefined();
  expect(nestedRecord).toBeUndefined();
  await database.end();
});

test('Transaction transaction CommitInNestedTransaction', async () => {
  const database = getDatabase();
  const transaction = await database.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.transaction();
  const nestedId = await transaction.savetest1.save({ a: 1 });
  await transaction.commit();
  const firstTransactionBeforeCommit = await database.savetest1.all.filter({ id }).single();
  await transaction.commit();
  const firstTransactionAfterCommit = await database.savetest1.all.filter({ id }).single();
  const nestedRecord = await database.savetest1.all.filter({ id: nestedId }).single();

  expect(firstTransactionBeforeCommit).toBeUndefined();
  expect(firstTransactionAfterCommit).toBeDefined();
  expect(nestedRecord).toBeDefined();
  await database.end();
});

test('Transaction transaction Multipletransactions Commit', async () => {
  const database = getDatabase();
  const transaction = await database.transaction();
  await transaction.transaction();
  await transaction.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.commit();
  await transaction.commit();
  await transaction.commit();
  const record = await database.savetest1.all.filter({ id }).single();
  expect(record).toBeDefined();
  await database.end();
});

test('Transaction transaction SeriesOfCommitsAndRollbacks', async () => {
  const database = getDatabase();
  const transaction = await database.transaction();
  await transaction.transaction();
  await transaction.transaction();
  const id = await transaction.savetest1.save({ a: 1 });
  await transaction.commit();
  await transaction.rollback();
  await transaction.commit();
  const record = await database.savetest1.all.filter({ id }).single();
  expect(record).toBeUndefined();
  await database.end();
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
    transaction: (transaction) => transaction.transaction(),
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
    const database = getDatabase();
    const transaction = await database.transaction();
    const { operations, commands } = transactionCompleteTests;
    operations[operation](transaction);
    await expect(commands[command](transaction)).rejects.toThrow();
    await database.end();
  }
);

test('Transaction SafeWrapper CanCommit', async () => {
  const database = getDatabase();
  let id;
  await database.transaction(async (transaction) => {
    id = await transaction.savetest1.save({ a: 1 });
  });
  const record = await database.savetest1.all.filter({ id }).single();
  expect(record).toBeDefined();
  await database.end();
});

test('Transaction SafeWrapper CanReject', async () => {
  const database = getDatabase();
  let id;
  const toThrow = new Error();
  let thrownException;

  try {
    await database.transaction(async (transaction) => {
      id = await transaction.savetest1.save({ a: 1 });
      throw toThrow;
    });
  } catch (e) {
    thrownException = e;
  }
  const record = await database.savetest1.all.filter({ id }).single();
  expect(record).toBeUndefined();
  expect(thrownException).toBe(toThrow);
  await database.end();
});

test('Delete All', async () => {
  const database = getDatabase();
  const transaction = await database.transaction();
  await transaction.savetest1.all.delete();
  await transaction.savetest1.save({ a: 1 });
  const count = await transaction.savetest1.all.delete();
  transaction.rollback();
  expect(count).toBe(1);
  await database.end();
});

test('Delete ByQuery', async () => {
  const database = getDatabase();
  const canDeleteNumber = Math.floor(Math.random() * 1e6);
  await database.savetest1.all.filter({ a: canDeleteNumber }).delete();
  const transaction = await database.transaction();
  await transaction.savetest1.save({ a: canDeleteNumber });
  await transaction.savetest1.save({ a: 3433 });
  const itemsDeletedFirstAttempt = await transaction.savetest1.all.filter({ a: canDeleteNumber }).delete();
  const itemsDeletedSecondAttempt = await transaction.savetest1.all.filter({ a: canDeleteNumber }).delete();
  transaction.rollback();
  expect(itemsDeletedFirstAttempt).toBe(1);
  expect(itemsDeletedSecondAttempt).toBe(0);
  await database.end();
});

test('Update All', async () => {
  const database = getDatabase();
  const transaction = await database.transaction();
  await transaction.savetest1.all.delete();
  await transaction.savetest1.save({ a: 1 });
  await transaction.savetest1.save({ a: 2 });
  await transaction.savetest1.all.update({ a: 3 });
  const count = await transaction.savetest1.all.filter({ a: 3 }).count();
  transaction.rollback();
  expect(count).toBe(2);
  await database.end();
});

test('Update ByQuery', async () => {
  const database = getDatabase();
  const transaction = await database.transaction();
  await transaction.savetest1.all.delete();
  await transaction.savetest1.save({ a: 1 });
  await transaction.savetest1.save({ a: 1 });
  await transaction.savetest1.save({ a: 3 });
  await transaction.savetest1.all.filter({ a: 1 }).update({ a: 2 });
  const count = await transaction.savetest1.all.filter({ a: 2 }).count();
  transaction.rollback();
  expect(count).toBe(2);
  await database.end();
});
