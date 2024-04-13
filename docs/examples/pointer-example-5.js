import { Point, Points, printPoint, printPoints } from './pointer-example-5.zig';

const array = new Float64Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]);
printPoints(Points(array.buffer));
const view = new DataView(array.buffer, 16, 16);
printPoint(Point(view));