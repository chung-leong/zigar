import { print8 } from './int-example-3.zig?optimize=Debug';

try {
   print8(128);
} catch (err) {
   console.log(err.message);
}
