import { NumberAndNothing } from './null-example-2.zig';

const struct = new NumberAndNothing({ number: 1234 });
console.log(struct.valueOf());
