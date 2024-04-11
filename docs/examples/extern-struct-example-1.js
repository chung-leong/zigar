import { ext_struct, reg_struct } from './extern-struct-example-1.zig';

console.log('Extern:');
console.log(ext_struct.dataView.getInt16(0, true));
console.log(ext_struct.dataView.getBigInt64(8, true));
console.log('Regular (wrong):');
console.log(reg_struct.dataView.getInt16(0, true));
console.log(reg_struct.dataView.getBigInt64(8, true));
console.log('Regular (correct):');
console.log(reg_struct.dataView.getInt16(8, true));
console.log(reg_struct.dataView.getBigInt64(0, true));
