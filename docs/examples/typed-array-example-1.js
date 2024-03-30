import { Float32Slice, Int32Array4 } from './typed-array-example-1.zig';

const array = new Int32Array4([ 1, 2, 3, 4 ]);
console.log(array.typedArray);
const slice = new Float32Slice((function*() {
  for (let i = 1; i <= 10; i++) {
    yield Math.PI * i;
  }
})());
console.log(slice.typedArray);
