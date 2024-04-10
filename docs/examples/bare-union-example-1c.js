// using a query variable to set the optimization level ---v
import { b } from './bare-union-example-1.zig?optimize=ReleaseSmall';

try {
    console.log(b.big_integer);
    console.log(b.integer);
    console.log(b.decimal);
} catch (err) {
    console.log(err.message);
}
