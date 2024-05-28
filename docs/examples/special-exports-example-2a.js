import { __zigar, Struct1, Struct2 } from './special-exports-example-2.zig';
const { sizeOf } = __zigar;

console.log(sizeOf(Struct1));
console.log(sizeOf(Struct2));
