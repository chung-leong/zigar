import { Hello } from './dollar-sign-example-1.zig';

const hello = new Hello({ number1: 1000, number2: 2000 });
console.log(hello.valueOf());
hello.$ = { number3: 3000 };
console.log(hello.valueOf());
