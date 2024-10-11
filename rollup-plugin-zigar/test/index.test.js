import NodeResolve from '@rollup/plugin-node-resolve';
import { expect } from 'chai';
import { readFile } from 'fs/promises';
import 'mocha-skip-if';
import { tmpdir } from 'os';
import { join } from 'path';
import { rollup } from 'rollup';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';
import Zigar from '../dist/index.js';

describe('Loader', function() {
  describe('Options', function() {
    const path = absolute('../../zigar-compiler/test/zig-samples/basic/console.zig');
    it('should generate code with embedded WASM by default', async function() {
      this.timeout(60000);
      const code = await transpile(path, { embedWASM: true });
      expect(code).to.contain('atob');
    })
    it('should generate code that uses fetch when embedWASM is false', async function() {
      this.timeout(60000);
      const code = await transpile(path, { embedWASM: false, nodeCompat: false });
      expect(code).to.contain('fetch');
    })
    it('should generate code that uses readFile when embedWASM is false and nodeCompat is true', async function() {
      this.timeout(300000);
      const code = await transpile(path, { embedWASM: false, nodeCompat: true });
      expect(code).to.contain('readFile');
    })
    it('should default to ReleaseSmall where NODE_ENV is production', async function() {
      this.timeout(300000);
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
    it('should serve transcoded files through Vite', async function() {
      this.timeout(300000);
      const host = 'localhost';
      const port = 10001;
      const server = await createServer({
        root: absolute('./example'),
        server: { host, port, watch: null },
        plugins: [
          Zigar({}),
          NodeResolve({
            modulePaths: [ absolute(`../node_modules`) ],
          }),
        ],
        optimizeDeps: {
          include: [],
        },
      });
      await server.listen();
      const rootJsReq = await fetch(`http://${host}:${port}/test.js`);
      const rootJsText = await rootJsReq.text();
      const jsURI = /from "(.*?)"/.exec(rootJsText)?.[1];
      expect(jsURI).to.be.a('string');
      const jsReq = await fetch(`http://${host}:${port}${jsURI}`);
      const jsText = await jsReq.text();
      const wasmURI = /url = "(.*?\.wasm.*?)"/.exec(jsText)?.[1];
      expect(wasmURI).to.be.a('string');
      const wasmReq = await fetch(`http://${host}:${port}${wasmURI}`);
      const wasmBlob = await wasmReq.blob();
      expect(wasmBlob).to.be.a('blob');
      expect(wasmBlob.size).to.be.at.least(100000);
      server.close();
    })
  })
})

async function transpile(path, options = {}) {
  const hash = await md5(path);
  const jsPath = join(tmpdir(), 'rollup-test', `${hash}.mjs`);
  const inputOptions = {
    input: path,
    plugins: [
      Zigar(options),
      NodeResolve({
        modulePaths: [ absolute(`../node_modules`) ],
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

function absolute(relPath) {
  return fileURLToPath(new URL(relPath, import.meta.url));
}
