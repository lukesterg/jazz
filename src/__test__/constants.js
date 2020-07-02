import Jazz from '../';
import scrub from 'scrub-a-dub-dub';

export const defaultModels = {
  class: {
    id: Jazz.field.primaryKey(),
    name: scrub.string(),
    teacher: scrub.string(),
    funding: scrub.number(),
    helper: scrub.string(),
    students: Jazz.field.hasMany('student', { relatedField: 'class' }),
  },
  student: {
    id: Jazz.field.primaryKey(),
    name: scrub.string(),
    age: scrub.number(),
    class: Jazz.field.hasOne('class'),
    address: Jazz.field.hasOne('address'),
  },
  address: {
    id: Jazz.field.primaryKey(),
    city: scrub.string(),
    student: Jazz.field.hasMany('student', { relatedField: 'address' }),
  },
  // playground for inserting data which can be deleted which wont interfere with read tests
  savetest1: {
    id: Jazz.field.primaryKey(),
    a: scrub.number(),
  },
  savetest2: {
    id: Jazz.field.primaryKey(),
    a: scrub.number(),
    b: scrub.number(),
  },
  savetest3_author: {
    id: Jazz.field.primaryKey(),
    name: scrub.string(),
    books: Jazz.field.hasMany('savetest3_book', { relatedField: 'author' }),
  },
  savetest3_book: {
    id: Jazz.field.primaryKey(),
    name: scrub.string(),
    author: Jazz.field.hasOne('savetest3_author'),
  },
};
