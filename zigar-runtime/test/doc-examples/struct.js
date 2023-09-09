// struct.js
import { StructA } from './struct.zig';

const buffer = new ArrayBuffer(8);
const struct = StructA(buffer);
struct.dog = 123;
struct.cat = 456;
const view = new DataView(buffer);
console.log(view.getInt32(0, true), view.getInt32(4, true));

// console output:
// 123 456
