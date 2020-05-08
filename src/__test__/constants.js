import { number, hasOne, hasMany } from '../model';

export const defaultModels = {
  class: {
    id: number({ primaryKey: true }),
    name: {},
    teacher: {},
    funding: {},
    helper: {},
    students: hasMany('student', { relatedField: 'class' }),
  },
  student: {
    id: number({ primaryKey: true }),
    name: {},
    age: {},
    class: hasOne('class'),

    // TODO: remove relatedField
    address: hasOne('address'),
  },
  address: {
    id: number({ primaryKey: true }),
    city: {},
    student: hasMany('student', { relatedField: 'address' }),
  },
};
