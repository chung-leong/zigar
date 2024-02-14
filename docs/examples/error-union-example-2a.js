import { getSquareRoots } from './error-union-example-2.zig';

const numbers = [ 1, 2, 3, -4, 5 ];
try {
    const sqrts = getSquareRoots(numbers);
    for (const [ index, sqrt ] of sqrts.entries()) {
        const number = numbers[index];
        console.log(`sqrt(${number}) = ${sqrt}`);
    }
} catch (err) {
    console.log(err.message);
}
