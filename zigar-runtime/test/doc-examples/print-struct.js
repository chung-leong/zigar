// print-struct.js
import { printStruct } from './print-struct.zig';

printStruct({ a: { number1: 123, number2: 456 }, number3: 77 });
printStruct({ a: null, number3: 77 });

// console output:
// print-struct.StructB{ .a = print-struct.StructA{ .number1 = 123, .number2 = 456 }, .number3 = 7.7e+01 }
// print-struct.StructB{ .a = null, .number3 = 7.7e+01 }
