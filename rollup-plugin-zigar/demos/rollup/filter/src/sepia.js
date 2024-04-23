import { createOutput } from '../zig/sepia.zig';

export async function createImageData(src, params) {
    const { width, height } = src;
    const { dst } = await createOutput(width, height, { src }, params);
    const ta = dst.data.typedArray;
    const clampedArray = new Uint8ClampedArray(ta.buffer, ta.byteOffset, ta.byteLength);
    return new ImageData(clampedArray, width, height); 
}
