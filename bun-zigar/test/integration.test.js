import 'mocha-skip-if';
import { arch, endianness } from 'os';
import { addTests } from '../../zigar-compiler/test/integration/index.js';

for (const optimize of [ 'Debug', 'ReleaseSmall', 'ReleaseSafe', 'ReleaseFast' ]) {
  skip.permanently.if(process.env.npm_lifecycle_event === 'coverage').
  describe(`Integration tests (bun-zigar, ${optimize})`, function() {
    addTests((path, options) => importModule(path, { optimize, ...options }), {
      littleEndian: endianness() === 'LE',
      addressSize: /64/.test(arch()) ? 64 : 32,
      target: 'native',
      optimize,
    });
  })
}

let currentModule;

async function importModule(path, options) {
  const {
    optimize,
    multithreaded,
    omitFunctions,
    omitVariables,
  } = options;
  currentModule?.__zigar?.abandon();
  const query = `optimize=${optimize}&`
              + `multithreaded=${multithreaded ? 1 : 0}&`
              + `omit-functions=${omitFunctions ? 1 : 0}&`
              + `omit-variables=${omitVariables ? 1 : 0}&`;
  // query variables actually get discarded currently               
  currentModule = await import(path + '?' + query);
  return currentModule;
}
