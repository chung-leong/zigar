import module, { hello, pi } from './module-example-1.zig';

console.log(module.pi);
console.log(module.number);
module.hello();
hello();
console.log(pi);
