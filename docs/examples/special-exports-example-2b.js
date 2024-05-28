import { __zigar, Struct1, Struct2 } from './special-exports-example-2.zig';
const { alignOf } = __zigar;

console.log(alignOf(Struct1));
console.log(alignOf(Struct2));
