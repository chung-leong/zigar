import module from './tagged-union-example-1.zig';

console.log(module.v.big_integer);
console.log(module.v.integer);
try {
    module.v.integer = 1234;
} catch (err) {
    console.log(err.message);
}
