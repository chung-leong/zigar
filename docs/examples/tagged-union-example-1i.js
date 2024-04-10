import module from './tagged-union-example-1.zig';

console.log(module.v.integer);
module.v = { integer: 1234 };
console.log(module.v.integer);
