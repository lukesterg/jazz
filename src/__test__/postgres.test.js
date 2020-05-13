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

test('FindBy HasOneField', async () => {
  const connection = createConnection();
  const result = await connection.student.all
    .filter({ class__name: 'Year 3' })
    .order('name')
    .values('name', { flat: true });
  expect(result).toEqual(['Alison', 'Troy']);
});

test('FindBy HasManyField', async () => {
  const connection = createConnection();
  const result = await connection.class.all
    .filter({ students__name: 'Alison' })
    .order('name')
    .values('name', { flat: true });
  expect(result).toEqual(['Year 3']);
});

test('FindBy MultipleLevelsOfRelatedFields', async () => {
  const connection = createConnection();
  const results = await connection.class.all
    .filter({ students__address__city: 'Moil' })
    .values('name', { flat: true, distinct: true });
  expect(results).toEqual(['Year 3']);
});

test('FindBy NotRelated', async () => {
  const connection = createConnection();
  const results = await connection.student.all.filter({ address__isnull: true }).values('name', { flat: true });
  expect(results).toEqual(['John']);
});

test('FindBy NotRelated AndRelated', async () => {
  const connection = createConnection();
  const results = await connection.student.all
    .filter({ address__isnull: true }, { address__city: 'Moil' })
    .values('name', { flat: true });
  expect(results).toEqual(['Troy', 'Alison', 'John']);
});

test('FindBy MultipleRelations InSameModel', async () => {
  const connection = createConnection();
  const results = await connection.class.all
    .filter({ students__name: 'Troy', students__age: 5 })
    .values('name', { flat: true });
  expect(results).toEqual(['Year 3']);
});

test('FindBy MultipleRelations InDifferentModels', async () => {
  const connection = createConnection();
  const results = await connection.student.all
    .filter({ class__name: 'Year 3', address__city: 'Moil' })
    .values('name', { flat: true });
  expect(results).toEqual(['Troy', 'Alison']);
});

test('FindBy RelationObject', async () => {
  const connection = createConnection();
  const existingClass = await connection.class.all.filter({ name: 'Year 3' }).single();
  const students = await connection.student.all
    .filter({ class: existingClass })
    .order('name')
    .values('name', { flat: true });
  expect(students).toEqual(['Alison', 'Troy']);
});

test('Select RelatedField ManyToOne', async () => {
  const connection = createConnection();
  const classesWithStudents = await connection.student.all.values('class__name', { flat: true, distinct: true });
  classesWithStudents.sort();
  expect(classesWithStudents).toEqual(['Year 3', 'Year 4']);
});

test('Select RelatedField OneToMany', async () => {
  const connection = createConnection();
  const studentsInClasses = await connection.class.all.values('students__name', { flat: true, distinct: true });
  studentsInClasses.sort();
  // the null occurs because of an optional join. One class does not have any students.
  expect(studentsInClasses).toEqual(['Alison', 'Joe', 'John', 'Troy', null]);
});

// In this instance there is a where condition creating an inner join. The values respects the inner join.
test('Select RelatedField InnerJoinedByFilter', async () => {
  const connection = createConnection();
  const studentsInClasses = await connection.class.all
    .filter({ students__age__lte: 10 })
    .values('students__name', { flat: true, distinct: true });
  studentsInClasses.sort();
  expect(studentsInClasses).toEqual(['Alison', 'Joe', 'John', 'Troy']);
});

test('OrderBy RelatedField', async () => {
  const connection = createConnection();
  const classesWithStudents = await connection.class.all
    .order('students__name')
    .values('students__name', { flat: true, distinct: true });
  expect(classesWithStudents).toEqual(['Alison', 'Joe', 'John', 'Troy', null]);
});

test('OrderBy RelatedField InnerJoinedByFilter', async () => {
  const connection = createConnection();
  const classesWithStudents = await connection.class.all
    .filter({ students__age__lte: 10 })
    .order('students__name')
    .values('students__name', { flat: true, distinct: true });
  expect(classesWithStudents).toEqual(['Alison', 'Joe', 'John', 'Troy']);
});

test('Aggregate Count AllRecords', async () => {
  const connection = createConnection();
  const studentCount = await connection.student.all.values(JazzDb.aggregation.count());
  expect(studentCount).toEqual([{ all__count: '4' }]);
});

test('Aggregate Count Field', async () => {
  const connection = createConnection();
  const studentCount = await connection.class.all.values(JazzDb.aggregation.count('helper'));
  expect(studentCount).toEqual([{ helper__count: '1' }]);
});

const aggregationTest = {
  min: [JazzDb.aggregation.min, 5],
  max: [JazzDb.aggregation.max, 10],
  average: [JazzDb.aggregation.average, 7.25],
  sum: [JazzDb.aggregation.sum, 29],
};
each(Object.keys(aggregationTest)).test('Aggregate %s Field', async (aggregationType) => {
  const connection = createConnection();
  const [aggregation, expectedResult] = aggregationTest[aggregationType];
  const aggregationResult = await connection.student.all.values(aggregation('age'), { flat: true });

  // decimal values and big ints are strings
  expect(+aggregationResult[0]).toEqual(expectedResult);
});
