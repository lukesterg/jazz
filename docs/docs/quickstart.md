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
