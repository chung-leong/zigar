import { get4Big } from './array-example-4.zig';

const { typedArray } = get4Big(50n);
console.log(typedArray instanceof BigInt64Array);
