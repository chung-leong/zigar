// struct-pointer.js
import { StructA, StructAPtr, StructAConstPtr } from './struct-pointer.zig';

const object = new StructA({ dog: 123, cat: 456 });
const ptr = new StructAPtr(object);
console.log(ptr.dog, ptr.cat);
ptr.dog = 1111;
ptr.cat = 3333;
const constPtr = new StructAConstPtr(object);
console.log(constPtr.dog, constPtr.cat);
try {
  constPtr.dog = 0;
} catch (err) {
  console.error(err);
}

// console output:
// 123 456
// 1111 3333
// TypeError: *const StructA cannot be modified
