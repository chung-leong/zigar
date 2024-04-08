import { fail } from './error-set-example-1.zig';

try {
  fail(3);
} catch (err) {
  console.log(JSON.stringify(err));
}
