import { getPi64, getPi32, getPi16 } from './float-example-2.zig';

console.log(`pi = ${getPi64()}`);
console.log(`pi = ${getPi32().toPrecision(8)}`);
console.log(`pi = ${getPi16().toPrecision(4)}`);
