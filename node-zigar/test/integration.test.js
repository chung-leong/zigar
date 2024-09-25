import 'mocha-skip-if';
import { arch, endianness } from 'os';
import { addTests } from '../../zigar-compiler/test/integration/index.js';

for (const optimize of [ 'Debug', 'ReleaseSmall', 'ReleaseSafe', 'ReleaseFast' ]) {
  skip.permanently.if(process.env.npm_lifecycle_event === 'coverage').
  describe(`Integration tests (node-zigar, ${optimize})`, function() {
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
  } = options;
  currentModule?.__zigar?.abandon();
  currentModule = await import(`${path}?optimize=${optimize}&multithreaded=${multithreaded ? 1 : 0}`);
  return currentModule;
}
