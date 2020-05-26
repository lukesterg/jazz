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
    contacts: Jazz.field.hasMany('contacts', { relatedField: 'employee' }),
  },

  contacts: {
    id: { primaryKey: true },
    employee: Jazz.field.hasOne('employees'),
    phone: {},
  },
};

Jazz.addSchema(schema);

async function main() {
  const database = await Jazz.getDatabase();
  const bobEmployeeRecord = { name: 'Bob', age: 5 };
  await database.employees.save(bobEmployeeRecord);
  await database.contacts.save({ employee: bobEmployeeRecord, phone: '0411521369' });
  await database.contacts.save({ employee: bobEmployeeRecord, phone: '0432130558' });

  const aliceEmployeeRecord = { name: 'Alice', age: 10 };
  await database.employees.save(aliceEmployeeRecord);
  await database.contacts.save({ employee: aliceEmployeeRecord, phone: '0411456789' });

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
  // Relationships
  // ****************************************************************

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
