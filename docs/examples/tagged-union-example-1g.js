import { c } from './tagged-union-example-1.zig';

const [[ tag, value ]] = c;
console.log(`${tag} => ${value}`);
