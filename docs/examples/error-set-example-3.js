import { fail } from './error-set-example-3.zig';

try {
  fail();
} catch (err) {
  console.log(err.message);
}
