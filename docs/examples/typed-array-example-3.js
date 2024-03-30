import { Float32Vector3Slice } from './typed-array-example-3.zig';

const slice = new Float32Vector3Slice((function*() {
    for (let i = 1; i <= 4; i++) {
        yield [ 1, 2, 3 ].map(n => n * i);
    }
})());
console.log(slice.valueOf());
console.log(slice.typedArray);
