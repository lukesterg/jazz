# Jazz

![](https://github.com/lukesterg/jazz/workflows/build/badge.svg?branch=master) [![Documentation Status](https://readthedocs.org/projects/jazz-orm/badge/?version=latest)](https://jazz-orm.readthedocs.io/en/latest/?badge=latest) [![Maintainability](https://api.codeclimate.com/v1/badges/437579d48f287f13bd59/maintainability)](https://codeclimate.com/github/lukesterg/jazz/maintainability)

## Overview

Jazz is a simple API to abstract the database layer of your application. Jazz allows your to write your entire application in JavaScript and be able to switch database at any time.

Jazz allows you to abstract the database layer into objects, for instance:

Fetch all employees who are 10 years of age:
`const employeesWhoAre10 = await database.employees.all.filter({ age: 10 }).get();`

Fetch all employees who are over 10 years of age:
`const employeesWhoAreOver10 = await database.employees.all.filter({ age__gt: 10 }).get();`

Count the employees over 10 at a particular address:

```
const numberOfEmployeesAtAnAddress = await database.address.all
  .filter({ employee__age__gt: 10})
  .get('address', Jazz.aggregation.count(), { flat: true });

```

## Documentation

To install run `npm i jazz-orm`.

Please read the documentation at https://jazz-orm.readthedocs.io/en/latest/.
