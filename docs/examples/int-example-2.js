import { getIntSize, getUintSize } from './int-example-2.zig';

console.log(typeof getIntSize(0x7FFF_FFFF_FFFF_FFFFn));
console.log(typeof getIntSize(0x001F_FFFF_FFFF_FFFFn));
console.log(typeof getUintSize(0xFFFF_FFFF_FFFF_FFFFn));
console.log(typeof getUintSize(1));
