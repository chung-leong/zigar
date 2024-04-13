import { setI8 } from './pointer-example-4.zig';

const array = new Int8Array(5);
setI8(array, 42);
console.log(array);
