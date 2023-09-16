// slice-u16-reinit.js
import { Uint16Slice } from './slice-u16.zig';

const slice = new Uint16Slice('Hello');
const oldTarget = slice['*'];
console.log(slice.string);
slice.$ = 'World!!!';
const newTarget = slice['*'];
console.log(slice.string);
console.log(oldTarget === newTarget);

// console output:
// Hello
// World!!! 
// false
