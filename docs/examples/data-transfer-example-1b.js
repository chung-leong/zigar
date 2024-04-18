import { set } from './data-transfer-example-1.zig';

const buffer = new ArrayBuffer(16);
const int32 = new DataView(buffer, 1, 4);
const int16 = new DataView(buffer, 4, 2);
try {
    set(int16, int32);
} catch (err) {
    console.log(err.message);
}
