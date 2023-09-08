import { printTag, Pet } from './print-enum.zig';

printTag(Pet.Dog);
printTag(Pet.Cat);
printTag(Pet.Snake);

// console output:
// Dog: 0
// Cat: 1
// Snake: 2
