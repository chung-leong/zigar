import { createHash } from 'crypto';
import 'mocha-skip-if';
import { tmpdir } from 'os';
import { join, parse } from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';
import { addTests } from '../../zigar-compiler/test/integration/index.js';

for (const optimize of [ 'Debug', 'ReleaseSmall', 'ReleaseSafe', 'ReleaseFast' ]) {
  skip.permanently.if(process.env.npm_lifecycle_event === 'coverage').
  describe(`Integration tests (zigar-loader, ${optimize})`, function() {
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
    embedWASM = true,
    topLevelAwait = true,
    useLibc = false,
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
  const loader = resolve('../dist/index.js');
  const path = fileURLToPath(url);
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
            optimize,
            topLevelAwait,
            embedWASM,
            useLibc,
            keepNames: optimize === 'ReleaseSafe',
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
