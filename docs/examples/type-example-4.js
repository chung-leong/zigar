import { PointI32, PointI64 } from './type-example-4.zig';

const p1 = new PointI32({ x: 45, y: -12 });
console.log(p1.Type.name, p1.valueOf());
const p2 = new PointI64({ x: 45, y: -12 });
console.log(p2.Type.name, p2.valueOf());
