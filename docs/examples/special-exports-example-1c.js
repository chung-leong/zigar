import { __zigar } from './special-exports-example-1.zig';
const { abandon, released } = __zigar;

abandon();
// force garbage collection to occur (need --expose-gc)
gc();   
// give V8 a chance to invoke object finalizers
await new Promise(r => setTimeout(r, 0));
console.log(released());
