import { Point } from './data-type-example-1.zig';

const descriptors = Object.getOwnPropertyDescriptors(Point.prototype);
for (const [ name, desc ] of Object.entries(descriptors)) {
    if (desc.get) {
        console.log({ name, desc });
    }
}