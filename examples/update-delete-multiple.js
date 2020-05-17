import Jazz from '../src';
/*
  To run this example first run the following SQL:

  create table employees (
    id serial not null,
    name varchar(100) not null,
    age int,
    primary key(id)
  );

  Ensure your NODE_DATABASE environment variable is setup to point to the database where you created this table.

  This script can be run on Mac OS and Linux using the following (remember to update the database path):
  `NODE_DATABASE=postgres://test:qwerty@localhost/test npx babel-node examples/update-delete-multiple.js`
*/

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

  const bobsAge = await database.employees.all.filter({ name: 'Bob' }).values('age');
  console.log(`Bob's age after update is`, bobsAge);
  // Bob's age after update is [ { age: 12 } ]

  await database.employees.all.update({ age: 20 });
  const allEmployeesAge = await database.employees.all.values('name', 'age');
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
