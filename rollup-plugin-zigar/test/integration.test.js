import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { rollup } from 'rollup'
import NodeResolve from '@rollup/plugin-node-resolve';
import Zigar from '../dist/index.js';
import { addTests } from '../../zigar-compiler/test/integration.js';
import 'mocha-skip-if';

for (const optimize of [ 'Debug', 'ReleaseSmall', 'ReleaseSafe', 'ReleaseFast' ]) {
  skip.permanently.if(process.env.npm_lifecycle_event === 'coverage').
  describe(`Integration tests (rollup-plugin-zigar, ${optimize})`, function() {
    addTests(path => importModule(path, optimize), {
      littleEndian: true,
      target: 'WASM-COMPTIME',
      optimize,
    });
  })
}

let currentModule;

async function importModule(path, optimize) {
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
  const hash = md5(path);
  const jsPath = join(tmpdir(), 'rollup-integration-test', optimize, `${hash}.mjs`);
  const inputOptions = {
    input: path,
    plugins: [
      Zigar({ optimize, useReadFile: true }),
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

function md5(text) {
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}
