import { writeFile, stat, mkdir } from 'fs/promises';
import { join, parse } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { transpile } from '../src/transpiler.js';
import { addTests } from './integration.js';

describe('Integration tests (zigar-compiler, Debug)', function() {
  beforeEach(function() {
    process.env.ZIGAR_TARGET = 'WASM-COMPTIME';
    process.env.ZIGAR_OPTIMIZE = 'Debug';
  })
  addTests(path => importModule(path), { littleEndian: true });
})
describe('Integration tests (zigar-compiler, ReleaseSmall)', function() {
  beforeEach(function() {
    process.env.ZIGAR_TARGET = 'WASM-COMPTIME';
    process.env.ZIGAR_OPTIMIZE = 'ReleaseSmall';
  })
  addTests(path => importModule(path), { littleEndian: true });
})
describe('Integration tests (zigar-compiler, ReleaseSafe)', function() {
  beforeEach(function() {
    process.env.ZIGAR_TARGET = 'WASM-COMPTIME';
    process.env.ZIGAR_OPTIMIZE = 'ReleaseSafe';
  })
  addTests(path => importModule(path), { littleEndian: true });
})
describe('Integration tests (zigar-compiler, ReleaseFast)', function() {
  beforeEach(function() {
    process.env.ZIGAR_TARGET = 'WASM-COMPTIME';
    process.env.ZIGAR_OPTIMIZE = 'ReleaseFast';
  })
  addTests(path => importModule(path), { littleEndian: true });
})

async function importModule(path) {
  const optimize = process.env.ZIGAR_OPTIMIZE;
  const moduleResolver = () => {
    return new URL('../../zigar-runtime/dist/index.js', import.meta.url).pathname;
  };
  const code = await transpile(path, { moduleResolver, optimize });
  const hash = md5(path);
  // need to use .mjs since the file is sitting in /tmp, outside the scope of our package.json
  const jsDir = join(tmpdir(), 'compiler-integration-test', optimize);
  const jsPath = join(jsDir, `${hash}.mjs`);
  await mkdirp(jsDir);
  await writeFile(jsPath, code);
  return import(jsPath);
}

function md5(text) {
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

async function mkdirp(path) {
  try {
    await stat(path);
  } catch (err) {
    const { dir } = parse(path);
    await mkdirp(dir);
    try {
      await mkdir(path);
    } catch (err) {
      /* c8 ignore next 3 */
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
  }
}
