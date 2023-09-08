import { add, MathError } from './add-error.zig';

console.log(add(1, 2));
try {
  add(0, 1);
} catch (err) {
  console.error(err);
  console.log(err instanceof MathError);
}

// console output:
// 3
// [error{UnexpectedSpanishInquisition,RecordIsScratched} [Error]: Unexpected spanish inquisition]
// true
