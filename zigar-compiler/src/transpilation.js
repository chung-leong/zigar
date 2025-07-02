import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { defineEnvironment } from '../../zigar-runtime/src/environment.js';
import * as mixins from '../../zigar-runtime/src/mixins.js';
import { generateCode } from './code-generation.js';
import { compile } from './compilation.js';
import { extractLimits, stripUnused } from './wasm-decoding.js';

export async function transpile(srcPath, options) {
  const {
    nodeCompat = false,
    embedWASM = true,
    topLevelAwait = true,
    omitExports = false,
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
  Object.assign(compileOptions, { arch: 'wasm32', platform: 'wasi', isWASM: true });
  const { outputPath, sourcePaths } = await compile(srcPath, null, compileOptions);
  const content = await readFile(outputPath);
  const { memoryMax, memoryInitial, tableInitial } = extractLimits(new DataView(content.buffer));
  const multithreaded = compileOptions.multithreaded ?? false;
  const moduleOptions = {
    memoryMax,
    memoryInitial,
    tableInitial,
    multithreaded,
  };
  const Env = defineEnvironment();
  const env = new Env();
  env.loadModule(content, moduleOptions);
  await env.initPromise;
  env.acquireStructures();
  const definition = env.exportStructures();
  const usage = {};
  for (const [ name, mixin ] of Object.entries(mixins)) {
    if (env.mixinUsage.get(mixin) && name !== 'FeatureStructureAcquisition') {
      usage[name] = true;
    }
  }
  if (nodeCompat && usage.FeatureWorkerSupport) {
    usage.FeatureWorkerSupportCompat = true;
    usage.FeatureWorkerSupport = false;
  }
  const mixinPaths = [];
  for (const [ name, inUse ] of Object.entries(usage)) {
    if (inUse) {
      // change name to snake_case
      const parts = name.replace(/\B([A-Z])/g, ' $1').toLowerCase().split(' ');
      const type = parts.shift();
      const dir =  (type === 'wasi') ? 'wasi' : `${type}s`;
      const filename = parts.join('-') + '.js';
      mixinPaths.push(`${dir}/${filename}`);
    }
  }
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
    mixinPaths,
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
