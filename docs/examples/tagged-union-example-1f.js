import { c } from './tagged-union-example-1.zig';

console.log(c.integer ?? c.big_integer ?? c.decimal);