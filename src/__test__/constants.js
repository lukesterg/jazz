import { number, hasOne, hasMany, hasOneType } from '../model';

export const defaultModels = {
  class: {
    id: number({ primaryKey: true }),
    name: {},
    teacher: {},
    funding: {},
    helper: {},
    students: hasMany('address', { relatedField: 'student' }),
  },
  student: {
    id: number({ primaryKey: true }),
    name: {},
    age: {},
    class: hasOne('class', { relatedField: 'students' }),

    // TODO: remove relatedField
    address: hasMany('address', { relatedField: 'student' }),
  },
  address: {
    id: number({ primaryKey: true }),
    city: {},
    student: hasMany('student', { relatedField: 'address' }),
  },
};
