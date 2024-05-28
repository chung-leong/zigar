import { StructA, StructB } from './packed-struct-example-3.zig';

const a = new StructA({ apple: true, durian: true });
const b = new StructB({ agnieszka: true, basia: true });
console.log(Number(a));
console.log(BigInt(b));
console.log(a == 9);
console.log(b == 3n);