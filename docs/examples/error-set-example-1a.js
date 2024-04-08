import { FileOpenError, fail } from './error-set-example-1.zig';

try {
  fail(2);
} catch (err) {
  console.log(err.message);
  console.log(err === FileOpenError.out_of_memory);
}
