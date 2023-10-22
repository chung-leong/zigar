// cow.js
import { Cow } from './cow.zig';

const base64 = '0gQAAGQAAAAFAAAAAAAAAAAAAAAACHJA';
const cow = new Cow({ base64 });
for (const [ name, value ] of Object.entries(cow)) {
  console.log(`${name}: ${value}`);
}

// console output:
// id: 1234
// weight: 100
// age: 5
// price: 288.5
