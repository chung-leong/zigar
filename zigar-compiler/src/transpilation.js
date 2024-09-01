import { readFile } from 'fs/promises';
import { basename } from 'path';
import { createEnvironment } from '../zigar-runtime/src/index.js';
import { generateCode } from './code-generation.js';
import { compile } from './compilation.js';
import { findSourceFile, getAbsoluteMapping } from './configuration.js';
import { extractLimits, stripUnused } from './wasm-decoding.js';

export async function transpile(path, options) {
  const {
    embedWASM = true,
    topLevelAwait = true,
    omitExports = false,
    stripWASM = (options.optimize && options.optimize !== 'Debug'),
    keepNames = false,
    moduleResolver = (name) => name,
    wasmLoader,
    sourceFiles,
    ...compileOptions
  } = options;
  if (typeof(wasmLoader) !== 'function') {
    if (embedWASM !== true) {
      throw new Error(`wasmLoader is a required option when embedWASM is false`);
    }
  }
  Object.assign(compileOptions, { arch: 'wasm32', platform: 'wasi', isWASM: true });
  const srcPath = path.endsWith('.zig') ? path : findSourceFile(path, {
    sourceFiles: getAbsoluteMapping(sourceFiles, process.cwd()),
  });
  const { outputPath, sourcePaths } = await compile(srcPath, null, compileOptions);
  const content = await readFile(outputPath);
  const { memoryMax, memoryInitial, tableInitial } = extractLimits(new DataView(content.buffer));
  const moduleOptions = {
    memoryMax,
    memoryInitial,
    tableInitial,
    multithreaded: compileOptions.multithreaded ?? false,
  };
  const env = createEnvironment();
  env.loadModule(content, moduleOptions);
  await env.initPromise;
  env.acquireStructures(compileOptions);
  const definition = env.exportStructures();
  const runtimeURL = moduleResolver('zigar-runtime');
  let binarySource;
  if (env.hasMethods()) {
    let dv = new DataView(content.buffer);
    if (stripWASM) {
      dv = stripUnused(dv, { keepNames });
    }
    if (embedWASM) {
      binarySource = embed(srcPath, dv);
    } else {
      binarySource = await wasmLoader(srcPath, dv);
    }
  }
  const { code, exports, structures } = generateCode(definition, {
    declareFeatures: true,
    runtimeURL,
    binarySource,
    topLevelAwait,
    omitExports,
    moduleOptions,
  });
  return { code, exports, structures, sourcePaths };
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
  await new Promise(r => setTimeout(r, 0));
  return bytes.buffer;
})()`;
}
