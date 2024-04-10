import { getB, getT } from './bare-union-example-2.zig';

try {
    console.log(getT(false).number);
    console.log(getT(true).text.string);
    console.log(getB(false).number);
    console.log(getB(true).text.string);
} catch (err) {
    console.log(err.message);
}
