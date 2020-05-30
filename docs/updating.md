# Updating and deleting

If you want to update a singular item please use the save function. If you wish to update or delete multiple records or a primary key, please refer to the code below:

```js
// Full running example (with more instructions) can be found in Github repository in folder examples/update-delete-multiple.js.
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

  await database.employees.save({ name: 'Bob', age: 5 });
  await database.employees.save({ name: 'Alice', age: 10 });

  const updateCount = await database.employees.all.filter({ name: 'Bob' }).update({ age: 12 });
  console.log('Number of records updated', updateCount);
  // Number of records updated 1

  const bobsAge = await database.employees.all.filter({ name: 'Bob' }).get('age');
  console.log(`Bob's age after update is`, bobsAge);
  // Bob's age after update is [ { age: 12 } ]

  await database.employees.all.update({ age: 20 });
  const allEmployeesAge = await database.employees.all.get('name', 'age');
  console.log('Employees ages after updating all their ages', allEmployeesAge);
  // Employees ages after updating all their ages [ { name: 'Alice', age: 20 }, { name: 'Bob', age: 20 } ]

  const deletingBobCount = await database.employees.all.filter({ name: 'Bob' }).delete();
  console.log(`Number of records deleted when deleting Bob ${deletingBobCount}`);
  // Number of records deleted when deleting Bob 1

  const deleteAllCount = await database.employees.all.delete();
  console.log(`Deleting all remaining records count ${deleteAllCount}`);
  // Deleting all remaining records count 1

  database.end();
}

main().catch((error) => console.error('error occurred', error));
```
