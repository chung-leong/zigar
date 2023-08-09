import { join, parse } from 'path';
import { expect } from 'chai';
import { tmpdir } from 'os';
import { readFile } from 'fs/promises';
import webpack from 'webpack'
import 'mocha-skip-if';

const loader = resolve('../dist/index.js');

describe('Loader', function() {
  describe('Options', function() {
    it('should generate code with embedded WASM by default', async function() {
      const path = resolve('./integration/console.zig');
      const code = await transpile(path, { embedWASM: true });
      expect(code).to.contain('atob');
    })
    it('should generate code that uses fetch when embedWASM is false', async function() {
      const path = resolve('./integration/console.zig');
      const code = await transpile(path, { embedWASM: false, useReadFile: false });
      expect(code).to.contain('fetch');
    })
    it('should generate code that uses readFile when embedWASM is false and useReadFile is true', async function() {
      const path = resolve('./integration/console.zig');
      const code = await transpile(path, { embedWASM: false, useReadFile: true });
      expect(code).to.contain('readFile');
    })
    it('should fail when unknown options are present', async function() {
      let error;
      try {
        const path = resolve('./integration/console.zig');
        const code = await transpile(path, { turkey: true });
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error').with.property('message').that.contains('turkey');
    })
  })
})

async function transpile(path, options = {}) {
  const hash = await md5(path + JSON.stringify(options));
  const jsPath = join(tmpdir(), 'webpack-test', `${hash}.mjs`);
  const jsFile = parse(jsPath);
  const config = {
    mode: 'development',
    entry: path,
    target: 'node',
    output: {
      library: {
        type: 'module',
      },
      filename: jsFile.base,
      path: jsFile.dir,
      chunkFormat: 'module',
    },
    resolve: {
      modules: [ resolve(`../node_modules`) ],
    },
    module: {
      rules: [
        {
          test: /\.zig$/,
          loader,
          exclude: /node_modules/,
          options,
        },
      ]
    },
    experiments: {
      outputModule: true,
    },
  };
  await new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (!err && stats?.hasErrors()) {
        err = new Error(stats);
      }
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
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
