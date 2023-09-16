// struct-pointer-deref.js
import { StructA, StructAPtr } from './struct-pointer.zig';

const object = new StructA({ dog: 123, cat: 456 });
const ptr = new StructAPtr(object);
const target = ptr['*'];

console.log(object === target);

// console output:
// true
