import { floatToString, freeString } from './data-transfer-example-2.zig';

const array = floatToString(Math.PI);
console.log(array.string);
freeString(array);
console.log(array.string);
