import { join, parse } from 'path';
import { expect } from 'chai';
import { tmpdir } from 'os';
import { readFile } from 'fs/promises';
import { rollup } from 'rollup'
import NodeResolve from '@rollup/plugin-node-resolve';
import Zigar from '../dist/index.js';
import 'mocha-skip-if';

describe('Loader', function() {
  describe('Options', function() {
    const path = resolve('../../zigar-compiler/test/zig-samples/basic/console.zig');
    it('should generate code with embedded WASM by default', async function() {
      const code = await transpile(path, { embedWASM: true });
      expect(code).to.contain('atob');
    })
    it('should generate code that uses fetch when embedWASM is false', async function() {
      const code = await transpile(path, { embedWASM: false, useReadFile: false });
      expect(code).to.contain('fetch');
    })
    it('should generate code that uses readFile when embedWASM is false and useReadFile is true', async function() {
      const code = await transpile(path, { embedWASM: false, useReadFile: true });
      expect(code).to.contain('readFile');
    })
    it('should default to ReleaseSmall where NODE_ENV is production', async function() {
      const code1 = await transpile(path, { embedWASM: true });
      process.env.NODE_ENV = 'production';
      try {
        const code2 = await transpile(path, { embedWASM: true });
        expect(code2.length).to.be.below(code1.length);
      } finally {
        delete process.env.NODE_ENV;
      }
    })
    it('should fail when unknown options are present', async function() {
      let error;
      try {
        const code = await transpile(path, { turkey: true });
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error').with.property('message').that.contains('turkey');
    })
    it('should fail when optimize option is incorrect', async function() {
      let error;
      try {
        const code = await transpile(path, { optimize: 'Donut' });
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error').with.property('message').that.contains('ReleaseFast');
    })
  })
})

async function transpile(path, options = {}) {
  const hash = await md5(path + JSON.stringify(options));
  const jsPath = join(tmpdir(), 'rollup-test', `${hash}.mjs`);
  const inputOptions = {
    input: path,
    plugins: [
      Zigar({ ...options }),
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
  const code = await readFile(jsPath, 'utf-8');
  return code;
}

async function md5(text) {
  const { createHash } = await import('crypto');
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}
