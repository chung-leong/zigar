import { createOutput } from '../zig/sepia.zig';

async function createImageData(width, height, source, params) {
  const input = { src: source };
  const output = await createOutput(width, height, input, params);
  const ta = output.dst.data.typedArray;
  const clampedArray = new Uint8ClampedArray(ta.buffer, ta.byteOffset, ta.byteLength);
  return new ImageData(clampedArray, width, height);
}

onmessage = async (evt) => {
  const [ name, jobId, ...args ] = evt.data;
  try {
    const [ result, transfer ] = await runFunction(name, args);
    postMessage([ name, jobId, result ], { transfer });
  } catch (err) {
    postMessage([ 'error', jobId, err ]);
  }
};

async function runFunction(name, args) {
  switch (name) {
    case 'createImageData':
      const output = await createImageData(...args);
      const transfer = [ output.data.buffer ];
      return [ output, transfer ];
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}