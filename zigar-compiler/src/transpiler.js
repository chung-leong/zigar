import { readFile } from 'fs/promises';
import { basename } from 'path';
import { compile } from './compiler.js';
import { runModule } from '../../zigar-runtime/src/index.js';
import { generateCode } from './code-generator.js';
import { stripUnused } from './wasm-stripper.js';

export async function transpile(path, options = {}) {
  const { env } = process;
  const {
    embedWASM = true,
    topLevelAwait = true,
    omitFunctions = false,
    stripWASM = (options.optimize && options.optimize !== 'Debug'),
    keepNames = false,
    moduleResolver = (name) => name,
    wasmLoader,
    ...compileOptions
  } = options;
  if (typeof(wasmLoader) !== 'function') {
    if (embedWASM !== true) {
      throw new Error(`wasmLoader is a required option when embedWASM is false`);
    }
  }
  const wasmPath = await compile(path, {
    ...compileOptions,
    arch: 'wasm32',
    platform: 'freestanding'
  });
  const content = await readFile(wasmPath);
  const { structures, runtimeSafety } = await runModule(content, { omitFunctions });
  // all methods are static, so there's no need to check the instance methods
  const hasMethods = !!structures.find(s => s.static.methods.length > 0);
  const runtimeURL = moduleResolver('zigar-runtime');
  let loadWASM;
  if (hasMethods) {
    let dv = new DataView(content.buffer);
    if (stripWASM) {
      dv = stripUnused(dv, { keepNames });
    }
    if (embedWASM) {
      loadWASM = embed(path, dv);
    } else {
      loadWASM = await wasmLoader(path, dv);
    }
  }
  return generateCode(structures, { runtimeURL, loadWASM, runtimeSafety, topLevelAwait });
}

function embed(path, dv) {
  const base64 = Buffer.from(dv.buffer, dv.byteOffset, dv.byteLength).toString('base64');
  return `(async () => {
  // ${basename(path)}
  const binaryString = atob(${JSON.stringify(base64)});
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
})()`;
}
