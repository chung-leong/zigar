import { get4 } from './array-example-2.zig';

const array = get4(80);
console.log(array[3]);
for (const value of array) {
    console.log(value);
}
console.log([ ...array ]);
