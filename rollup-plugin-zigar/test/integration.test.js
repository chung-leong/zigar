import NodeResolve from '@rollup/plugin-node-resolve';
import { createHash } from 'crypto';
import 'mocha-skip-if';
import { tmpdir } from 'os';
import { join } from 'path';
import { rollup } from 'rollup';
import { fileURLToPath } from 'url';
import { addTests } from '../../zigar-compiler/test/integration/index.js';
import Zigar from '../dist/index.js';

for (const optimize of [ 'Debug', 'ReleaseSmall', 'ReleaseSafe', 'ReleaseFast' ]) {
  skip.permanently.if(process.env.npm_lifecycle_event === 'coverage').
  describe(`Integration tests (rollup-plugin-zigar, ${optimize})`, function() {
    addTests((url, options) => importModule(url, { optimize, ...options }), {
      littleEndian: true,
      addressSize: 32,
      target: 'wasm32',
      optimize,
    });
  })
}

let currentModule;

async function importModule(url, options) {
  const {
    optimize,
    embedWASM = false,
    useLibc = false,
    useRedirection = true,
    topLevelAwait = true,
    multithreaded = false,
    omitFunctions = false,
    omitVariables = false,
    maxMemory = undefined,
  } = options;
  if (currentModule) {
    await currentModule.__zigar?.abandon();
    if (global.gc) {
      global.gc();
      const released = await currentModule.__zigar?.released();
      if (released === false) {
        console.warn(`WebAssembly instance has not been released`);
      }
    }
    currentModule = null;
  }
  const path = fileURLToPath(url);
  const hash = sha1(path + JSON.stringify(options));
  const jsPath = join(tmpdir(), 'rollup-integration-test', optimize, `${hash}.mjs`);
  const inputOptions = {
    input: path,
    plugins: [
      Zigar({
        optimize,
        nodeCompat: true,
        keepNames: optimize === 'ReleaseSafe',
        topLevelAwait,
        multithreaded,
        useLibc,
        useRedirection,
        embedWASM,
        omitFunctions,
        omitVariables,
        maxMemory,
      }),
      NodeResolve({
        modulePaths: [ resolve(`../node_modules`) ],
      }),
    ],
  };
  const outputOptions = {
    file: jsPath,
    format: 'esm',
  };
  const bundle = await rollup(inputOptions);
  try {
    await bundle.write(outputOptions);
  } finally {
    await bundle.close();
  }
  currentModule = await import(jsPath);
  return currentModule;
}

function sha1(text) {
  const hash = createHash('sha1');
  hash.update(text);
  return hash.digest('hex');
}

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}
