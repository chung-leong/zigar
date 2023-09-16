// struct-print.js
import { printStruct } from './struct-pointer.zig';

try {
  printStruct({ dog: 123, cat: 456 });
} catch (err) {
  console.error(err);
}

// console output:
// *StructA cannot point to an object
