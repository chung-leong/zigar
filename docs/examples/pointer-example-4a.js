import { setI8 } from './pointer-example-4.zig';

const buffer = new ArrayBuffer(5);
setI8(buffer, 8);
console.log(buffer);
