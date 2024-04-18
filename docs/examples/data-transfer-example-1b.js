import { set } from './data-transfer-example-1.zig';

const buffer = new ArrayBuffer(16);
const i32 = new DataView(buffer, 1, 4);
const i16 = new DataView(buffer, 4, 2);
try {
    set(i16, i32);
} catch (err) {
    console.log(err.message);
}
