import { tuple } from './tuple-example-1.zig';

console.log(tuple.length);
for (const element of tuple) {
    console.log(element);
}
console.log([ ...tuple ]);
console.log(tuple.valueOf());
console.log(JSON.stringify(tuple));
