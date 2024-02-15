import { Vector, cross, dot } from './vector-example-1.zig';

const v1 = new Vector([ 0.5, 1, 0 ]);
const v2 = new Vector([ 3, -4, 9 ]);

const p1 = dot(v1, v2);
console.log(`dot product = ${p1}`);
const p2 = cross(v1, v2);
console.log(`cross product = [ ${[ ...p2 ]} ]`);
