# Creating and updating records

Jazz allows saving data to a database by calling the `save` method.

```js
// Full running example (with more instructions) can be found in Github repository in folder examples/saving-data.js.
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
  const bob = { name: 'Bob', age: 3 };
  await database.employees.save(bob);

  console.log('Created a new employee record', bob);
  // Bob has been inserted in to the employees table in the database, the output shows:
  //   { name: 'Bob', age: 3, id: 1 }

  bob.age = 5;
  await database.employees.save(bob);
  console.log(`Updated Bob's age`, bob);
  // Bob has been updated in the the employees table in the database, the output shows:
  //   { name: 'Bob', age: 5, id: 1 }

  await database.employees.all.filter({ id: bob.id }).update({ age: 10 });
  const fetchedBobsRecord = await database.employees.all.filter({ name: 'Bob' }).single();
  console.log(`Updated Bob's age without fetching the record, Bob's record is now`, fetchedBobsRecord);
  // Bob has been updated in the employees table in the database, the output shows:
  //   { id: 1, name: 'Bob', age: 10 }

  database.end();
}

main().catch((error) => console.error('error occurred', error));
```
