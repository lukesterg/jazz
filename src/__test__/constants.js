import Jazz from '../';

export const defaultModels = {
  class: {
    id: Jazz.field.number({ primaryKey: true }),
    name: {},
    teacher: {},
    funding: {},
    helper: {},
    students: Jazz.field.hasMany('student', { relatedField: 'class' }),
  },
  student: {
    id: Jazz.field.number({ primaryKey: true }),
    name: {},
    age: Jazz.field.number(),
    class: Jazz.field.hasOne('class'),
    address: Jazz.field.hasOne('address'),
  },
  address: {
    id: Jazz.field.number({ primaryKey: true }),
    city: {},
    student: Jazz.field.hasMany('student', { relatedField: 'address' }),
  },
  // playground for inserting data which can be deleted which wont interfere with read tests
  savetest1: {
    id: Jazz.field.number({ primaryKey: true }),
  },
  savetest2: {
    id: Jazz.field.number({ primaryKey: true }),
    a: {},
    b: {},
  },
  savetest3_author: {
    id: Jazz.field.number({ primaryKey: true }),
    name: {},
    books: Jazz.field.hasMany('savetest3_book', { relatedField: 'author' }),
  },
  savetest3_book: {
    id: Jazz.field.number({ primaryKey: true }),
    name: {},
    author: Jazz.field.hasOne('savetest3_author'),
  },
};
