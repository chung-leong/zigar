// print-struct-defaults.js
import { printStruct } from './print-struct-defaults.zig';

printStruct({ a: {}, number3: 77 });
printStruct({ number3: 77 });

// console output:
// print-struct-defaults.StructB{ .a = print-struct-defaults.StructA{ .number1 = 1, .number2 = 2 }, .number3 = 7.7e+01 }
// print-struct-defaults.StructB{ .a = null, .number3 = 7.7e+01 }
