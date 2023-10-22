// cow-with-a-vengeance.js
import { Cow } from './cow.zig';

const cow = new Cow({
  id: 1234,
  weight: 100,
  age: 5,
  price: 288.5
});
console.log(JSON.stringify(cow, undefined, 2));

// console output:
// {
//   "id": 1234,
//   "weight": 100,
//   "age": 5,
//   "price": 288.5
// }
