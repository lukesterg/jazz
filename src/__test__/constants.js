import { field } from '../model';

export const defaultModels = {
  class: {
    id: field.number({ primaryKey: true }),
    name: {},
    teacher: {},
    funding: {},
    helper: {},
    students: field.hasMany('student', { relatedField: 'class' }),
  },
  student: {
    id: field.number({ primaryKey: true }),
    name: {},
    age: field.number(),
    class: field.hasOne('class'),
    address: field.hasOne('address'),
  },
  address: {
    id: field.number({ primaryKey: true }),
    city: {},
    student: field.hasMany('student', { relatedField: 'address' }),
  },
  // playground for inserting data which can be deleted which wont interfere with read tests
  savetest1: {
    id: field.number({ primaryKey: true }),
  },
};
