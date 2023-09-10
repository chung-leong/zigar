// bare-union-price.js
import { getPrice } from './bare-union-price.zig';

const price = getPrice('USD', 123);
console.log(`USD = ${price.USD}`);
try {
  console.log(`PLN = ${price.PLN}`);
} catch (err) {
  console.error(err);
}
console.log(Object.keys(price));

// console output:
// USD = 123
// TypeError: Accessing property pln when usd is active
// [ 'USD', 'EUR', 'PLN', 'MOP' ]
