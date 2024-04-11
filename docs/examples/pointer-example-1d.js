import module from './pointer-example-1.zig';

module.b.pointer['*'] = { number1: 123, number2: 456 };
module.a.print();
