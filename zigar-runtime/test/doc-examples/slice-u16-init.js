// slice-u16-init.js
import { Uint16Slice } from './slice-u16.zig';

const slice1 = new Uint16Slice('Hello');
// this performs the same action more verbosely
const slice2 = new Uint16Slice(new Uint16Slice.child('Hello'));
console.log(slice1.string, slice2.string);

// console output:
// Hello Hello
