import { set } from './data-transfer-example-1.zig';

const buffer = new ArrayBuffer(16);
const int32 = new DataView(buffer, 1, 4);
const int16 = new DataView(buffer, 3, 2);
set(int16, int32);
console.log(buffer);