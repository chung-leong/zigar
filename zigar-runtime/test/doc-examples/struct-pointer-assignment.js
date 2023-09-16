// struct-pointer-assignment.js
import { StructA, StructAPtr } from './struct-pointer.zig';

const object = new StructA({ dog: 123, cat: 456 });
const ptr = new StructAPtr(object);
ptr['*'] = { dog: 1111, cat: 3333 };
console.log(object.dog, object.cat);

// console output:
// 1111 3333
