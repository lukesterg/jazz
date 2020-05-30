# Transactions

```js
// Full running example (with more instructions) can be found in Github repository in folder examples/transactions.js.
import Jazz from 'jazz-orm';

const schema = {
  employees: {
    id: { primaryKey: true },
    name: {},
    age: {},
  },
};

Jazz.addSchema(schema);

async function main() {
  const database = await Jazz.getDatabase();

  // Single transaction will work only commit data if there are no exceptions while processing the transaction.
  let bobRecord;
  await database.transaction(async (transaction) => {
    bobRecord = await transaction.employees.save({ name: 'Bob', age: 10 });
  });
  const fetchedBobRecord = await database.employees.all.filter({ id: bobRecord.id }).single();
  console.log('Successful transaction added record bob', fetchedBobRecord);
  // Output:
  //  Successful transaction added record bob { id: 1, name: 'Bob', age: 10 }

  // Nested transaction exception can be caught, which will only invalidate the inner transaction.
  // Beware inner transactions shame the connection as the outer transaction, so while the inner transaction is running
  // the outer connection will be the same as the inner transaction.
  let firstTransactionSallyRecord;
  let innerTransactionSamRecord;
  await database.transaction(async (outerTransaction) => {
    firstTransactionSallyRecord = await outerTransaction.employees.save({ name: 'Sally', age: 10 });
    try {
      await outerTransaction.transaction(async (innerTransaction) => {
        innerTransactionSamRecord = await innerTransaction.employees.save({ name: 'Sam', age: 10 });
        throw new Error('error');
      });
    } catch (e) {
      // handle the exception
    }
  });

  const firstTransactionSally = await database.employees.all.filter({ id: firstTransactionSallyRecord.id }).single();
  const innerTransactionSam = await database.employees.all.filter({ id: innerTransactionSamRecord.id }).single();
  console.log('First transaction succeeded, so record exists', firstTransactionSally);
  console.log('Inner transaction failed, so record does not exist', innerTransactionSam);
  // Output:
  //  First transaction succeeded, so record exists { id: 2, name: 'Sally', age: 10 }
  //  Inner transaction failed, so record does not exist undefined

  // If you don't catch an inner transaction then no data is committed
  let firstTransactionJamesRecord;
  let innerTransactionAlexRecord;
  try {
    await database.transaction(async (outerTransaction) => {
      firstTransactionJamesRecord = await outerTransaction.employees.save({ name: 'James', age: 10 });
      await outerTransaction.transaction(async (innerTransaction) => {
        innerTransactionAlexRecord = await innerTransaction.employees.save({ name: 'Alex', age: 10 });
        throw new Error('error');
      });
    });
  } catch (e) {
    // handle the exception
  }

  const firstTransactionJames = await database.employees.all.filter({ id: firstTransactionJamesRecord.id }).single();
  const innerTransactionAlex = await database.employees.all.filter({ id: innerTransactionAlexRecord.id }).single();
  console.log(
    'First transaction failed before inner transaction was not caught, so record does not exists',
    firstTransactionJames
  );
  console.log('Inner transaction failed, so record does not exist', innerTransactionAlex);
  // Output:
  //  First transaction failed before inner transaction was not caught, so record does not exists undefined
  //  Inner transaction failed, so record does not exist undefined

  database.end();
}

main().catch((error) => console.error('error occurred', error));
```
