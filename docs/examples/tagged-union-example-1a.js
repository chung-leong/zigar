import { a, b, c, d } from './tagged-union-example-1.zig';

console.log(a.integer);
console.log(b.big_integer);
console.log(c.decimal);
console.log(d.complex.valueOf());
