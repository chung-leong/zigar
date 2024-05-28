import { StructA, StructB } from './packed-struct-example-3.zig';

const a = new StructA(9);
const b = new StructB(3n);
console.log(a.valueOf());
console.log(b.valueOf());
