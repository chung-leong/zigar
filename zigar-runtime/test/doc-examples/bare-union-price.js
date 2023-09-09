// bare-union-price.js
import { getPrice } from './bare-union-price.zig';

const price = getPrice('usd', 123);
console.log(`USD = ${price.usd}`);
try {
  console.log(`PLN = ${price.pln}`);
} catch (err) {
  console.error(err);
}
console.log(Object.keys(price));

// console output:
// USD = 123
// Accessing property pln when usd is active
