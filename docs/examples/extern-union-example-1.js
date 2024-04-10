import { b } from './extern-union-example-1.zig';

try {
    console.log(b.big_integer);
    console.log(b.integer);   
} catch (err) {
    console.log(err.message);
}
