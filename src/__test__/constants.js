import { createModels, number, hasOne, hasMany } from '../model';

export const defaultModels = {
  class: {
    id: number({ primaryKey: true }),
    name: {},
    teacher: {},
    funding: {},
    helper: {},
  },
  student: {
    id: number({ primaryKey: true }),
    name: {},
    age: {},
    address: hasOne('address'),
  },
  address: {
    id: number({ primaryKey: true }),
    city: {},
    student: hasMany('student'),
  },
};
