import { get4Big } from './array-example-4.zig';

const array = get4Big(50n);
console.log([ ...array ]);
console.log(array.typedArray);
array.typedArray[3] = 1000n;
console.log([ ...array ]);