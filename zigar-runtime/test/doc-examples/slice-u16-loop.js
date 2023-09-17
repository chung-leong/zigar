// slice-u16-loop.js
import { Uint16Slice } from './slice-u16.zig';

const slice = new Uint16Slice('Привет!');

console.time('iterator');
for (let i = 0; i < 100000; i++) {
  for (const cp of slice) {
    if (i === 0) {
      console.log(cp.toString(16));
    }
  }
}
console.timeEnd('iterator');

console.time('bracket');
for (let i = 0; i < 100000; i++) {
  for (let j = 0; j < slice.length; j++) {
    const cp = slice[j];
    if (i === 0) {
      console.log(cp.toString(16));
    }
  }
}
console.timeEnd('bracket');

// console output:
// 41f
// 440
// 438
// 432
// 435
// 442
// 21
// iterator: 103.059ms
// 41f
// 440
// 438
// 432
// 435
// 442
// 21
// bracket: 840.617ms

