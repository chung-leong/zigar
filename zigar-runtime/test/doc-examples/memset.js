// memset.js
import {
  setU8, setI8,
  setU16, setI16,
  setU32, setI32,
  setU64, setI64,
  setF32, setF64,
} from './memset.zig';

const u8Array = new Uint8Array(4);
const i8Array = new Int8Array(4);
const u16Array = new Uint16Array(4);
const i16Array = new Int16Array(4);
const u32Array = new Uint32Array(4);
const i32Array = new Int32Array(4);
const u64Array = new BigUint64Array(4);
const i64Array = new BigInt64Array(4);
const f32Array = new Float32Array(4);
const f64Array = new Float64Array(4);

setU8(u8Array, 1);
console.log([ ...u8Array ]);
setU8(u8Array.buffer, 2); // ArrayBuffer
console.log([ ...u8Array ]);
setU8(new DataView(u8Array.buffer), 3); // DataView
console.log([ ...u8Array ]);
setI8(i8Array, 4);
console.log([ ...i8Array ]);
setU16(u16Array, 5);
console.log([ ...u16Array ]);
setI16(i16Array, 6);
console.log([ ...i16Array ]);
setU32(u32Array, 7);
console.log([ ...u32Array ]);
setI32(i32Array, 8);
console.log([ ...i32Array ]);
setU64(u64Array, 9n);
console.log([ ...u64Array ]);
setI64(i64Array, 10n);
console.log([ ...i64Array ]);
setF32(f32Array, 0.25);
console.log([ ...f32Array ]);
setF64(f64Array, 3.14);
console.log([ ...f64Array ]);

// console output:
// [ 1, 1, 1, 1 ]
// [ 2, 2, 2, 2 ]
// [ 3, 3, 3, 3 ]
// [ 4, 4, 4, 4 ]
// [ 5, 5, 5, 5 ]
// [ 6, 6, 6, 6 ]
// [ 7, 7, 7, 7 ]
// [ 8, 8, 8, 8 ]
// [ 9n, 9n, 9n, 9n ]
// [ 10n, 10n, 10n, 10n ]
// [ 0.25, 0.25, 0.25, 0.25 ]
// [ 3.14, 3.14, 3.14, 3.14 ]
