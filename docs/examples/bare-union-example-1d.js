import { b } from './bare-union-example-1.zig';

for (const [ tag, value ] of b) {
    console.log(`${tag} => ${value}`);
}
console.log(b.valueOf());
console.log(JSON.stringify(b, undefined, 4));
