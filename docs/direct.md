# Direct database access

```js
// Full running example (with more instructions) can be found in Github repository in folder examples/directDatabase.js.
import Jazz from 'jazz-orm';

async function main() {
  const database = await Jazz.getDatabase();

  // Run custom code depending on the database type
  if (database.databaseType === 'postgres') {
    // the database is postgres
  }

  const employeeName = 'Bob';

  // You can query using string interpolation, any variables included will be escaped.
  let results = await database.sql`select * from employees where name=${employeeName}`;
  console.log(`Employees with name ${employeeName}`, results);
  // Output:
  //  Employees with name Bob [ { id: 1, name: 'Bob', age: 5 } ]

  // You can also flatten the results.
  results = await database.sql({ flat: true })`select name, age from employees where name=${employeeName}`;
  console.log(`Employees with name ${employeeName}`, results);
  // Output:
  //  Employees with name Bob [ [ 'Bob', 5 ] ]

  database.end();
}

main().catch((error) => console.error('error occurred', error));
```
