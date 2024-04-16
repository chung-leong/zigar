import { Line } from './data-type-example-2.zig';

const line = new Line({
    p1: { x: 0, y: 0 },
    p2: { x: 1, y: 1 },
});
console.log(line);
console.log(line.p1);
console.log(line.p2);