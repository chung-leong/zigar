import { b, c } from './tagged-union-example-1.zig';

console.log(b.big_integer);
console.log(b.integer);

console.log(c.integer ?? c.big_integer ?? c.decimal);