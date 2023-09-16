// person-print-not-method.js
import { Person } from './person.zig';

const person = new Person({ 
  name: 'Amber',
  gender: 'Female',
  age: 37,
  psycho: true,
});
Person.print(person);

// console output:
// Name: Amber
// Gender: Female
// Age: 37,
// Psycho: Yes
