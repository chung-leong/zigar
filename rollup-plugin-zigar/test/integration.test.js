import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { rollup } from 'rollup'
import NodeResolve from '@rollup/plugin-node-resolve';
import Zigar from '../dist/index.js';
import { addTests } from '../../zigar-compiler/test/integration.js';

describe('Integration tests (rollup-plugin-zigar, Debug)', function() {
  beforeEach(function() {
    process.env.ZIGAR_OPTIMIZE = 'Debug';
  });
  addTests(path => importModule(path), { littleEndian: true });
})
describe('Integration tests (rollup-plugin-zigar, ReleaseSmall)', function() {
  beforeEach(function() {
    process.env.ZIGAR_OPTIMIZE = 'ReleaseSmall';
  });
  addTests(importModule, { littleEndian: true });
})
describe('Integration tests (rollup-plugin-zigar, ReleaseSafe)', function() {
  beforeEach(function() {
    process.env.ZIGAR_OPTIMIZE = 'ReleaseSafe';
  });
  addTests(importModule, { littleEndian: true });
})
describe('Integration tests (rollup-plugin-zigar, ReleaseFast)', function() {
  beforeEach(function() {
    process.env.ZIGAR_OPTIMIZE = 'ReleaseFast';
  });
  addTests(importModule, { littleEndian: true });
})

async function importModule(path) {
  const optimize = process.env.ZIGAR_OPTIMIZE;
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
  return import(jsPath);
}

function md5(text) {
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}
