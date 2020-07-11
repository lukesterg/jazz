// These validation tests are to check that model validation is working
// It is not validating scrub-a-dub-dub works.

import { defaultModels } from './constants';
import Jazz from '../';

const getDatabase = () => {
  const databaseName = Symbol();
  Jazz.createDatabase(process.env.NODE_DATABASE, databaseName);
  Jazz.addSchema(defaultModels, databaseName);
  return Jazz.getDatabase(databaseName);
};

test('Validate invalid type', async () => {
  const database = getDatabase();
  const action = database.savetest1.save({ a: 'z' });
  await expect(action).rejects.toThrow();
  await database.end();
});

test('Extra field is discarded', async () => {
  const database = getDatabase();
  const record = await database.savetest1.save({ a: 1, b: 3 });
  expect(record.id).toBeGreaterThan(0);
  expect(record.b).toBeUndefined();
  await database.end();
});

test('Related field as object with valid record', async () => {
  const database = getDatabase();
  const author = await database.savetest3_author.save({ name: 'Fred' });
  await database.savetest3_author.save(author);
  const book = await database.savetest3_book.save({ name: 'Little Book', author });
  await database.savetest3_book.save(book);
  await database.end();
  // expect no exception
});

test('Related field as object with invalid record', async () => {
  const database = getDatabase();
  const author = { name: 'Fred', id: 'bob' };
  const action = database.savetest3_book.save({ name: 'Little Book', author });
  await expect(action).rejects.toThrow();
  await database.end();
});

test('Related field with cyclic reference can validate', async () => {
  const database = getDatabase();
  const author = await database.savetest3_author.save({ name: 'Fred' });
  const book = { name: 'Little Book', author };
  author.books = [book];
  await database.savetest3_book.save(book);
  await database.end();
  // expect no exception
});

test('Related field as number', async () => {
  const database = getDatabase();
  const author = await database.savetest3_author.save({ name: 'Fred' });
  const book = { name: 'Little Book', author: author.id };
  await database.savetest3_book.save(book);
  await database.end();
  // expect no exception
});

test('Related field as number but string provided', async () => {
  const database = getDatabase();
  const author = await database.savetest3_author.save({ name: 'Fred' });
  const book = { name: 'Little Book', author: 'abc' };
  const action = database.savetest3_book.save(book);
  await expect(action).rejects.toThrow();
  await database.end();
});
