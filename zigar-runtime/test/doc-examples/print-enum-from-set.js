import { printTag, Pet } from './print-enum.zig';

printTag(Pet.Dog);
printTag(Pet.Cat);
printTag(Pet.Snake);

console.log(Pet.Dog instanceof Pet);

// console output:
// Dog: 0
// Cat: 1
// Snake: 2
// true
