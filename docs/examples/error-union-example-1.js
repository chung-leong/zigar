import { getSquareRoot } from './error-union-example-1.zig';

try {
    console.log(`sqrt(36) = ${getSquareRoot(36)}`);
    console.log(`sqrt(-36) = ${getSquareRoot(-36)}`);
} catch (err) {
    console.log(err.message);
}
