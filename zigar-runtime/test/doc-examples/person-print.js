// person-print.js
import { Person } from './person.zig';

const person = new Person({ 
  name: 'Amber',
  gender: 'Female',
  age: 37,
  psycho: true,
});
person.print();

// console output:
// Name: Amber
// Gender: Female
// Age: 37,
// Psycho: Yes
