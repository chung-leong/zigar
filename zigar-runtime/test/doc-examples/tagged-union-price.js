// tagged-union-price.js
import { getPrice } from './tagged-union-price.zig';

const price = getPrice('USD', 123);
console.log(`USD = ${price.USD}`);
console.log(`PLN = ${price.PLN}`);
for (const [ key, value ] of Object.entries(price)) {
  console.log(`${key} = ${value}`);
}
try {
  price.PLN = 500;
} catch (err) {
  console.error(err);
}
console.log(Object.keys(price));

// console output:
// USD = 123
// PLN = null
// USD = 123
// TypeError: Accessing property PLN when USD is active
// [ 'USD' ]
