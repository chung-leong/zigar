import module from './pointer-example-2.zig';

console.log(module.int_ptr['*']);
module.int_ptr['*'] = 555;
console.log(module.int);
module.int_ptr = 42;
console.log(module.int);
