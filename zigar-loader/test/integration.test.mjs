import { join, parse } from 'path';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import webpack from 'webpack'
import { addTests } from '../../zigar-compiler/test/integration.js';
import 'mocha-skip-if';

for (const optimize of [ 'Debug', 'ReleaseSmall', 'ReleaseSafe', 'ReleaseFast' ]) {
  skip.permanently.if(process.env.npm_lifecycle_event === 'coverage').
  describe(`Integration tests (zigar-loader, ${optimize})`, function() {
    addTests(path => importModule(path), {
      littleEndian: true,
      target: 'WASM-COMPTIME',
      optimize,
    });
  })
}

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
