import { getPi64, getPi80, getPi128 } from './float-example-1.zig';

console.log(getPi80() === getPi64()); 
console.log(getPi128()  === getPi64());
