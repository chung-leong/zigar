// cower.js
import { Cow } from './cow.zig';

const cow = new Cow({
  id: 1234,
  weight: 100,
  age: 5,
  price: 288.5
});
console.log(cow);
console.log('');
console.log(cow.valueOf());

// console output:
// Cow [cow.Cow] {
//     id: [Getter/Setter],
//     weight: [Getter/Setter],
//     age: [Getter/Setter],
//     price: [Getter/Setter],
//     [Symbol(memory)]: DataView {
//       byteLength: 24,
//       byteOffset: 0,
//       buffer: ArrayBuffer {
//         [Uint8Contents]: <00 00 00 00 00 08 72 40 d2 04 00 00 64 00 00 00 05 00 00 00 00 00 00 00>,
//         byteLength: 24
//       }
//     }
//   }
//
// { id: 1234, weight: 100, age: 5, price: 288.5 }