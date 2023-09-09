// tagged-union-price.js
import { getPrice } from './tagged-union-price.zig';

const price = getPrice('usd', 123);
console.log(`USD = ${price.usd}`);
console.log(`PLN = ${price.pln}`);
for (const [ key, value ] of Object.entries(price)) {
  console.log(`${key.toUpperCase()} = ${value}`);
}
try {
  price.pln = 500;
} catch (err) {
  console.error(err);
}
console.log(Object.keys(price));

// console output:
// USD = 123
// PLN = null
// USD = 123
// Accessing property pln when usd is active
