import { Hello } from './base64-example-1.zig';

const hello = new Hello({ number1: 1000, number2: 2000 });
const url = new URL(`http://example.net/?s=${hello.base64}`);
const helloCopy = new Hello({ base64: url.searchParams.get('s') });
console.log(hello.valueOf());
console.log(helloCopy.valueOf());
