import { U16String } from './u16-string.zig';

const s1 = new U16String({ string: '牛' });
console.log(`Unicode: ${s1[0].toString(16)}`);
const s2 = new U16String('牛');
console.log(`Unicode: ${s2[0].toString(16)}`);

// console output:
// Unicode: 725b
// console output:
// Unicode: 725b
