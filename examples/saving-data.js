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
  `NODE_DATABASE=postgres://test:password@localhost/test npx babel-node examples/saving-data.js`
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
