// greeting.js
import { getGreeting } from './greeting.zig';

const greeting = getGreeting('Bigus');
console.log(greeting);
console.log(greeting.string);
console.log([ ...greeting ]);

// console output
// [object []const u8]
// Hello, Bigus!
// [ TODO ]
