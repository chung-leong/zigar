import { __zigar, hello } from './special-exports-example-1.zig';
const { abandon } = __zigar;

hello();
abandon();
try {
    hello();
} catch (err) {
    console.log(err.message);
}
