import { __zigar, hello } from './special-exports-example-1.zig';
const { init } = __zigar;
await init();
hello();
