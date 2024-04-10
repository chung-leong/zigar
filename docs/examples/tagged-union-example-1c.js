import { c } from './tagged-union-example-1.zig';

for (const [ tag, value ] of c) {
    console.log(`${tag} => ${value}`);
}
