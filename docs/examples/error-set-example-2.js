import { AnyError } from './error-set-example-2.zig';

for (const [ name, err ] of AnyError) {
  console.log(err.message);
}
