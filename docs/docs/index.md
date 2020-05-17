# Introduction

Jazz is a simple API to abstract the database layer of your application. Jazz allows your to write your entire application in JavaScript and be able to switch database at any time.

<!-- prettier-ignore -->
!!! warning
    This is a test run of producing output. This project is not complete.

<!-- prettier-ignore -->
!!! info "Jazz currently has a minimal feature set"
    Jazz is currently a Minimum Viable Product (MVP) release. It supports selects, aggregations, relationships, inserts, updates, deletes, etc. however it is not polished.

    The main issues that need to be resolved in this area are:

      * Postgres is currently the only database supported.
      * Model is not validated on save, for instance sending a number to a text field will only get rejected by Postgres not this library.
      * Only one to many relationships are supported. Many to many relations will need to be resolved manually.
      * The SQL schema will need to be created manually.

# Quick start

## Installing

Run `npm i jazz-orm pg` to install the latest version of Jazz.

## Setting up a database

To connect to Jazz you will need to:

1. Set-up a database connection.
2. Define the database schema in JavaScript.

### Connect to a database

To connect to a database you must from a connection string. Currently only Postgres is supported, to connect to a Postgres database the connection string must be in the form `postgres://<username>:<password>@<host>/<database>`. To connect to the database my_database on your local system using the username app_user and the password secret set the connection string to `postgres://app_user:secret@localhost/my_database`.

The recommended way to connect to connect to a database is using the environment variable `NODE_DATABASE`. If you do this then you do not need to set-up a connection in code.

For more advanced connections please refer to the sample code below:

```js
import Jazz from 'jazz-orm';

// The recommended way to connect is using the environment variable NODE_DATABASE, then you don't need to run any code.
// You can configure the environment variable using the package dotenv (https://www.npmjs.com/package/dotenv).

// If you want to connect manually in code
Jazz.createDatabase('postgres://user:password@localhost/main-database');

// If you have more than one database, you will need to supply a name
Jazz.createDatabase('postgres://user:password@localhost/reporting', 'reporting');
```

### Define a schema

<!-- prettier-ignore -->
!!! warning
    The schema is currently underbaked, expect this to be changed in future versions.

The schema defines how Jazz will communicate with the database backend. The schema is an object keys which are tables, inside the tables are a series of fields. Each table must contain only
one primary key. Currently fields that are not primary keys or relationships need to be an empty object. For instance:

```js
import Jazz from 'jazz-orm';

const schema = {
    table: {
        id: { primaryKey: true },
        field: {},
        field2: {}.
    }
}

Jazz.addSchema(schema);
```

Only one to many relationships are supported. An example one to many relationship is below:

A database may contain multiple schemas, so you can break your schemas in to libraries. Related fields use strings to refer to the related table, so the data in

The schema is an object consisting keys which are database tables and fields. Every table **MUST** have only one primary.

Currently the only supported relationship type is one to many. If you need to use many to many, they must be resolved in to two one to many tables by creating an intermediary table.

```js
import Jazz from 'jazz-orm';

const schema = {
  employee: {
    id: { primaryKey: true },
    name: {},
    contact: Jazz.field.hasMany('contact', { relatedField: 'employee' }),
  },

  contact: {
    id: { primaryKey: true },
    employee: Jazz.field.hasOne('employee'),
    phone: {},
  },
};

Jazz.addSchema(schema);
```

If you have multiple databases, the schema also allows an optional name. As shown below:

```js
Jazz.createDatabase(connectionString, 'reporting');
Jazz.addSchema(schema, 'reporting');
```

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

  database.end();
}

main().catch(console.error);
```

# Queries

JavaScript objects representing database records can be queried using JavaScript. These records can be filtered, aggregated and ordered.

```js
// Full running example (with more instructions) can be found in Github repository in folder examples/querying.js.
import Jazz from 'jazz-orm';

const schema = {
  employees: {
    id: { primaryKey: true },
    name: {},
    age: {},
    contact: { }
  },

  contact:
};

Jazz.addSchema(schema);

async function main() {
  const database = await Jazz.getDatabase();
  await database.employees.save({ name: 'Bob', age: 5 });
  await database.employees.save({ name: 'Alice', age: 10 });
  await database.employees.save({ name: 'Sue', age: 12 });
  await database.employees.save({ name: 'Sue', age: 20 });
  await database.employees.save({ name: 'Unknown' }); // has no age

  // ****************************************************************
  // Filtering
  // ****************************************************************

  const allEmployees = await database.employees.all.values();
  console.log('All employees', allEmployees);
  /*
    All employees [
      { id: 1, name: 'Bob', age: 5 },
      { id: 2, name: 'Alice', age: 10 },
      { id: 3, name: 'Sue', age: 12 },
      { id: 4, name: 'Sue', age: 20 },
      { id: 5, name: 'Unknown', age: null }
    ]
  */

  const allEmployeesWhoAre10 = await database.employees.all.filter({ age: 10 }).values();
  console.log('Employees who are 10', allEmployeesWhoAre10);
  // Employees who are 10 [ { id: 2, name: 'Alice', age: 10 } ]

  const allEmployeesWhoAreNot10 = await database.employees.all.filter({ age__neq: 10 }).values();
  console.log('Employees who are not 10', allEmployeesWhoAreNot10);
  /*
    Employees who are not 10 [
      { id: 1, name: 'Bob', age: 5 },
      { id: 3, name: 'Sue', age: 12 },
      { id: 4, name: 'Sue', age: 20 }
    ]
  */

  const allEmployeesUnder10 = await database.employees.all.filter({ age__lt: 10 }).values();
  console.log('Employees who are under 10', allEmployeesUnder10);
  // Employees who are under 10 [ { id: 1, name: 'Bob', age: 5 } ]

  const allEmployees10OrUnder = await database.employees.all.filter({ age__lte: 10 }).values();
  console.log('Employees who are 10 years or under', allEmployees10OrUnder);
  // Employees who are 10 years or under [ { id: 1, name: 'Bob', age: 5 }, { id: 2, name: 'Alice', age: 10 } ]

  const allEmployeesOver10 = await database.employees.all.filter({ age__gt: 10 }).values();
  console.log('Employees who are over 10', allEmployeesOver10);
  // Employees who are over 10 [ { id: 3, name: 'Sue', age: 12 }, { id: 4, name: 'Sue', age: 20 } ]

  const allEmployees10OrOver = await database.employees.all.filter({ age__gte: 10 }).values();
  console.log('Employees who are 10 years or over', allEmployees10OrOver);
  /*
    Employees who are 10 years or over [
      { id: 2, name: 'Alice', age: 10 },
      { id: 3, name: 'Sue', age: 12 },
      { id: 4, name: 'Sue', age: 20 }
    ]
  */

  const allEmployeesWhoHaveAnAgeSpecified = await database.employees.all.filter({ age__isnull: false }).values();
  console.log('Employees who have an age specified', allEmployeesWhoHaveAnAgeSpecified);
  /*
    Employees who have an age specified [
      { id: 1, name: 'Bob', age: 5 },
      { id: 2, name: 'Alice', age: 10 },
      { id: 3, name: 'Sue', age: 12 },
      { id: 4, name: 'Sue', age: 20 }
    ]
  */
  const allEmployeesWhoDoNotHaveAnAgeSpecified = await database.employees.all.filter({ age__isnull: true }).values();
  console.log('Employees who have do not have an age specified', allEmployeesWhoDoNotHaveAnAgeSpecified);
  // Employees who have do not have an age specified [ { id: 5, name: 'Unknown', age: null } ]

  // ****************************************************************
  // Selecting fields
  // ****************************************************************
  const employeesByNameAndAge = await database.employees.all.values('name', 'age');
  console.log('Employees by name and age', employeesByNameAndAge);
  /*
    Employees by name and age [
      { name: 'Bob', age: 5 },
      { name: 'Alice', age: 10 },
      { name: 'Sue', age: 12 },
      { name: 'Sue', age: 20 },
      { name: 'Unknown', age: null }
    ]
  */

  const employeesByNameAndAgeFlat = await database.employees.all.values('name', 'age', { flat: true });
  console.log('Employees by name and age flattened', employeesByNameAndAgeFlat);
  /*
    Employees by name and age flattened [
      [ 'Bob', 5 ],
      [ 'Alice', 10 ],
      [ 'Sue', 12 ],
      [ 'Sue', 20 ],
      [ 'Unknown', null ]
    ]
  */

  const distinctEmployeeNames = await database.employees.all.values('name', { flat: true, distinct: true });
  console.log('Distinct employee names', distinctEmployeeNames);
  // Distinct employee names [ 'Unknown', 'Sue', 'Alice', 'Bob' ]

  // ****************************************************************
  // Ordering
  // ****************************************************************

  const employeeNames = await database.employees.all.order('name').values('name', { flat: true });
  console.log('Employee names ascending', employeeNames);
  // Employee names ascending [ 'Alice', 'Bob', 'Sue', 'Sue', 'Unknown' ]

  const employeeNamesDescending = await database.employees.all.order([['name', 'desc']]).values('name', { flat: true });
  console.log('Employee names descending', employeeNamesDescending);
  // Employee names descending [ 'Unknown', 'Sue', 'Sue', 'Bob', 'Alice' ]

  const employeesByNameAscendingThenAgeDescending = await database.employees.all
    .order(['name', ['age', 'desc']])
    .values('name', 'age', { flat: true });
  console.log('Employee by name ascending then age descending', employeesByNameAscendingThenAgeDescending);
  /*
    Employee by name ascending then age descending [
      [ 'Alice', 10 ],
      [ 'Bob', 5 ],
      [ 'Sue', 20 ],
      [ 'Sue', 12 ],
      [ 'Unknown', null ]
    ]
  */

  const first3EmployeesByName = await database.employees.all.order('name').values('name', { flat: true, limit: 3 });
  console.log('First 3 employees by name', first3EmployeesByName);
  // First 3 employees by name [ 'Alice', 'Bob', 'Sue' ]

  // ****************************************************************
  // Aggregations
  // ****************************************************************

  const aggregationCount = await database.employees.all.values(Jazz.aggregation.count());
  console.log('Count of all employees', aggregationCount);
  // Count of all employees [ { all__count: '5' } ]

  const employeesWithAge = await database.employees.all.values(Jazz.aggregation.count('age'));
  console.log('Count of all employees with age', employeesWithAge);
  // Count of all employees with age [ { age__count: '4' } ]

  const minimumAge = await database.employees.all.values(Jazz.aggregation.min('age'));
  console.log('Minimum employee age', minimumAge);
  // Minimum employee age [ { age__min: 5 } ]

  const maximumAge = await database.employees.all.values(Jazz.aggregation.max('age'));
  console.log('Maximum employee age', maximumAge);
  // Maximum employee age [ { age__max: 20 } ]

  const averageAge = await database.employees.all.values(Jazz.aggregation.average('age'));
  console.log('Average employee age', averageAge);
  // Average employee age [ { age__avg: '11.7500000000000000' } ]

  const totalAge = await database.employees.all.values(Jazz.aggregation.sum('age'));
  console.log('Sum of all employee ages', totalAge);
  // Sum of all employee ages [ { age__sum: '47' } ]

  // ****************************************************************
  // Convenience routines
  // ****************************************************************

  const bob = await database.employees.all.filter({ name: 'Bob' }).single();
  console.log('Finding an employee named Bob', bob);
  // The employee Bob will only return if he is found. If Bob is not found, single will return undefined.
  // Finding an employee named Bob { id: 1, name: 'Bob', age: 5 }

  const employeeCount = await database.employees.all.count();
  console.log('Number of employees', employeeCount);
  // Number of employees 5

  // ****************************************************************
  // Compound queries
  // ****************************************************************

  // All the functions above can be mixed together to create a compound query, such as
  const compoundQuery = await database.employees.all
    .filter({ age__gt: 5 })
    .order('name')
    .values('name', Jazz.aggregation.count(), { flat: true });
  console.log('Count of all employees over 5 ordered by name', compoundQuery);
  // Count of all employees over 5 ordered by name [ [ 'Alice', '1' ], [ 'Sue', '2' ] ]

  database.end();
}

main().catch((error) => console.error('error occurred', error));
```

# Updating and deleting

If you want to update a singular item please use the save function. If you wish to update or delete multiple records, please refer to the code below:

```js
import Jazz from '../src';
/*
  To run this example first run the following SQL:

  CREATE TABLE employees (
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
```
