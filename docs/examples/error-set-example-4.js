import { fail } from './error-set-example-4.zig';

try {
  fail();
} catch (err) {
  console.log(err.message);
}
