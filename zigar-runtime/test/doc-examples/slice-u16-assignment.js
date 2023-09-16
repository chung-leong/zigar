// slice-u16-assignment.js
import { Uint16Slice } from './slice-u16.zig';

const slice = new Uint16Slice('Hello');
slice['*'] = 'World';
console.log(slice.string);
try {
  slice['*'] = 'World!!!';
} catch (err) {
  console.error(err);
}

// console output:
// World
// [TODO]
