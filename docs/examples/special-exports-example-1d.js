import { __zigar, hello } from './special-exports-example-1.zig';
const { connect } = __zigar;

connect({
    log(s) {
        console.log(`Zig output: "${s}"`);
    }
});
hello();
