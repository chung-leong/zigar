import { getSquareRoots } from './error-union-example-2.zig';

const numbers = [ 1, 2, 3, -4, 5 ];
const sqrts = getSquareRoots(numbers);
for (const [ index, sqrt ] of sqrts.entries({ error: 'return' })) {
    const number = numbers[index];
    console.log(`sqrt(${number}) = ${sqrt}`);
}
