import module from './void-example-2.zig';

console.log(module.array_of_nothing.valueOf());
module.array_of_nothing[3] = undefined;
try {
    module.array_of_nothing[3] = 1;
} catch (err) {
    console.log(err.message)
}
