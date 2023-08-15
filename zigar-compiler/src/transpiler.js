import { readFile, writeFile } from 'fs/promises';
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
    optimize = (env.NODE_ENV === 'production') ? 'ReleaseSmall' : 'Debug',
    clean = (env.NODE_ENV === 'production'),
    stripWASM = (optimize !== 'Debug'),
    keepNames = false,
    moduleResolver = (name) => name,
    wasmLoader,
    ...otherOptions
  } = options;
  if (process.env.NODE_ENV !== 'production') {
    if (typeof(wasmLoader) !== 'function') {
      if (embedWASM !== true) {
        throw new Error(`wasmLoader is a required option when embedWASM is false`);
      }
    }
  }
  const wasmPath = await compile(path, { ...otherOptions, optimize, target: 'wasm' });
  const content = await readFile(wasmPath);
  const { structures, runtimeSafety } = await runModule(content, { omitFunctions });
  const hasMethods = !!structures.find(s => s.methods.length > 0);
  const runtimeURL = moduleResolver('zigar-runtime');
  const name = basename(wasmPath);
  let loadWASM;
  if (hasMethods) {
    let dv = new DataView(content.buffer);
    if (stripWASM) {
      dv = stripUnused(dv, { keepNames });
      //await writeFile(wasmPath.replace('.wasm', '.min.wasm'), dv);
    }
    //await writeFile(wasmPath.replace('.wasm', '.min.wasm'), dv);
    if (embedWASM) {
      loadWASM = embed(name, dv);
    } else {
      loadWASM = await wasmLoader(name, dv);
    }
  }
  return generateCode(structures, { runtimeURL, loadWASM, runtimeSafety, topLevelAwait });
}

function embed(name, dv) {
  const base64 = Buffer.from(dv.buffer, dv.byteOffset, dv.byteLength).toString('base64');
  return `(async () => {
  // ${name}
  const binaryString = atob(${JSON.stringify(base64)});
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
})()`;
}
