import { readFile, writeFile } from 'fs/promises';
import { compile } from './compiler.js';
import { runWASMBinary, serializeDefinitions } from './wasm-exporter.js';
import { stripUnused } from './wasm-stripper.js';

export async function transpile(path, options = {}) {
  const {
    embedWASM = true,
    moduleResolver = (name) => name,
    wasmLoader,
    omitFunctions,
    ...compileOptions
  } = options;
  const wasmPath = await compile(path, { ...compileOptions, target: 'wasm' });
  const content = await readFile(wasmPath);
  const structures = await runWASMBinary(content, { omitFunctions });
  const hasMethods = !!structures.find(s => s.methods.length > 0);
  const runtimeURL = moduleResolver('node-zig/wasm-runtime');
  let loadWASM;
  if (hasMethods) {
    if (embedWASM) {
      const binary = new DataView(content.buffer);
      const dv = stripUnused(binary);
      await writeFile(wasmPath.replace('.wasm', '.min.wasm'), dv);
      const base64 = Buffer.from(dv.buffer, dv.byteOffset, dv.byteLength).toString('base64');
      loadWASM = `(async () => {
        const binaryString = atob(${JSON.stringify(base64)});
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      })()`;
    } else {
      if (typeof(wasmLoader) !== 'function') {
        throw new Error(`wasmLoader is a required option when embedWASM is false`);
      }
      loadWASM = wasmLoader(wasmPath);
    }
  }
  return serializeDefinitions(structures, { runtimeURL, loadWASM });
}
