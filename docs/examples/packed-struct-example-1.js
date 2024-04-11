import { pac_struct, reg_struct } from './packed-struct-example-1.zig';

console.log(pac_struct.valueOf());
console.log(reg_struct.valueOf());
console.log(pac_struct.dataView.byteLength);
console.log(reg_struct.dataView.byteLength);
