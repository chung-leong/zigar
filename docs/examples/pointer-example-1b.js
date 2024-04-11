import module from './pointer-example-1.zig';

module.b.child.number1 = -123;
module.b.pointer.number1 = 123;
module.b.child.print();
module.b.pointer.print();
module.a.print();
