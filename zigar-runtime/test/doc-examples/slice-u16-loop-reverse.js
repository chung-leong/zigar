// slice-u16-loop-reverse.js
import { Uint16Slice } from './slice-u16.zig';

const slice = new Uint16Slice('Привет!');

console.time('get');
const { length, get, set } = slice;
for (let i = 0; i < 100000; i++) {
  for (let j = length - 1; j >= 0; j--) {
    const cp = get(j);
    if (i === 0) {
      console.log(cp.toString(16));
    }
  }
}
console.timeEnd('get');

console.time('bracket');
for (let i = 0; i < 100000; i++) {
  for (let j = slice.length - 1; j >= 0; j--) {
    const cp = slice[j];
    if (i === 0) {
      console.log(cp.toString(16));
    }
  }
}
console.timeEnd('bracket');

// console output:
// 21
// 442
// 435
// 432
// 438
// 440
// 41f
// get: 9.02ms
// 21
// 442
// 435
// 432
// 438
// 440
// 41f
// bracket: 539.534ms
