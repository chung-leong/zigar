// print-enum.js
import { printTag } from './print-enum.zig';

printTag('Dog');
printTag('Chicken');
try {
  printTag('Cow');
} catch (err) {
  console.error(err);
}

// console output:
// Dog: 0
// Chicken: 3
// TypeError: Enum item of the type Pet expected, received Cow
