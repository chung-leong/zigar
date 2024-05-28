import { a, b, c, d } from './tagged-union-example-1.zig';

for (const number of [a, b, c, d ]) {
    if (number == 'integer') {
        console.log(number.integer);
    } else if (number == 'big_integer') {
        console.log(number.big_integer);
    } else if (number == 'decimal') {
        console.log(number.decimal);
    } else if (number == 'complex') {
        console.log(number.complex.valueOf());
    }
}
