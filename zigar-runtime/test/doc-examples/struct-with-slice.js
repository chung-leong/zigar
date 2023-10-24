// struct-with-slice.js
import { StructB } from './struct-with-slice.zig';

const object = new StructB({ text: 'Hello' });
console.log(object.text.string);
object.text = 'World!!!';
console.log(object.text.string);

// console output:
// Hello
// World!!!
