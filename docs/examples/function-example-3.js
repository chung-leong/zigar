import { Rectangle } from './function-example-3.zig';

const rect = new Rectangle({ left: 5, right: 10, width: 20, height: 10 });
console.log(rect.size());
console.log(Rectangle.size({ left: 5, right: 10, width: 30, height: 15 }));
