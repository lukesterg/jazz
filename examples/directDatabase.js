import Jazz from '../src';
/*
  To run this example first run the following SQL:

  create table employees (
    id serial not null,
    name varchar(100) not null,
    age int,
    primary key(id)
  );

  insert into employees (name, age) values ('Bob', 5);
  insert into employees (name, age) values ('Alex', 10);


  Ensure your NODE_DATABASE environment variable is setup to point to the database where you created this table.

  This script can be run on Mac OS and Linux using the following (remember to update the database path):
  `NODE_DATABASE=postgres://test:password@localhost/test npx babel-node examples/directDatabase.js`
*/

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
  // Employees with name Bob [ { id: 1, name: 'Bob', age: 5 } ]

  // You can also flatten the results.
  results = await database.sql({ flat: true })`select name, age from employees where name=${employeeName}`;
  console.log(`Employees with name ${employeeName}`, results);
  // Employees with name Bob [ [ 'Bob', 5 ] ]

  database.end();
}

main().catch((error) => console.error('error occurred', error));
