// greeting.js
import { getGreeting } from './greeting.zig';

const greeting = getGreeting('Bigus');
console.log(`${greeting}`);
console.log(greeting.string);
console.log([ ...greeting ]);

// console output:
// [object []const u8]
// Hello, Bigus!
// [
//     72, 101, 108, 108, 111,
//     44,  32,  66, 105, 103,
//    117, 115,  33
// ]
