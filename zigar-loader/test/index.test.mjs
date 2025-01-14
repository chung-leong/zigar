import { expect } from 'chai';
import { readFile } from 'fs/promises';
import 'mocha-skip-if';
import { tmpdir } from 'os';
import { join, parse } from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';

const loader = absolute('../dist/index.js');

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
      this.timeout(60000);
      const code = await transpile(path, { embedWASM: false, nodeCompat: true });
      expect(code).to.contain('readFile');
    })
    it('should default to ReleaseSmall where NODE_ENV is production', async function() {
      this.timeout(60000);
      const code1 = await transpile(path, { embedWASM: true });
      const code2 = await transpile(path, { embedWASM: true, mode: 'production' });
      expect(code2.length).to.be.below(code1.length);
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
  const {
    mode = 'development',
    ...pluginOptions
  } = options;
  const hash = await md5(path);
  const jsPath = join(tmpdir(), 'webpack-test', `${hash}.mjs`);
  const jsFile = parse(jsPath);
  const config = {
    mode,
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
      modules: [ absolute(`../node_modules`) ],
    },
    module: {
      rules: [
        {
          test: /\.zig$/,
          loader,
          exclude: /node_modules/,
          options: pluginOptions,
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

function absolute(relPath) {
  return fileURLToPath(new URL(relPath, import.meta.url));
}
