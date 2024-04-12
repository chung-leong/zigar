import module from './pointer-example-2.zig';

console.log(`${module.int_ptr}`);
console.log(Number(module.int_ptr));
console.log(module.int_ptr == 123);
