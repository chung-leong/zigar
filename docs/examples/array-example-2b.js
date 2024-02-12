import { get4 } from './array-example-2.zig';

const array = get4(80);
const { get, set, length } = array;
for (let i = 0; i < length; i++) {
    console.log(get(i));
    set(i, i + 101);
}
console.log([ ...array ]);
