import { join, parse } from 'path';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import webpack from 'webpack'
import { addTests } from '../../zigar-compiler/test/integration.js';

describe('Integration tests (zigar-loader, Debug)', function() {
  beforeEach(function() {
    process.env.ZIGAR_OPTIMIZE = 'Debug';
  });
  addTests(path => importModule(path), { littleEndian: true });
})
describe('Integration tests (zigar-loader, ReleaseSmall)', function() {
  beforeEach(function() {
    process.env.ZIGAR_OPTIMIZE = 'ReleaseSmall';
  });
  addTests(importModule, { littleEndian: true });
})
describe('Integration tests (zigar-loader, ReleaseSafe)', function() {
  beforeEach(function() {
    process.env.ZIGAR_OPTIMIZE = 'ReleaseSafe';
  });
  addTests(importModule, { littleEndian: true });
})
describe('Integration tests (zigar-loader, ReleaseFast)', function() {
  beforeEach(function() {
    process.env.ZIGAR_OPTIMIZE = 'ReleaseFast';
  });
  addTests(importModule, { littleEndian: true });
})

async function importModule(path) {
  const optimize = process.env.ZIGAR_OPTIMIZE;
  const loader = resolve('../dist/index.js');
  const hash = await md5(path);
  const jsPath = join(tmpdir(), 'webpack-integration-test', optimize, `${hash}.mjs`);
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
          options: {
            embedWASM: true,
            optimize,
          }
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
