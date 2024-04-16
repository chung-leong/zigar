import { U8Pixels } from './data-type-example-3.zig';

const rawData = new Uint8Array(800 * 600 * 4);
const pixels = new U8Pixels(rawData);
const pixelSlice = pixels['*'];
console.log(pixelSlice);
pixelSlice[3] = [ 255, 255, 255, 255 ];
console.log(pixelSlice);
