import 'mocha-skip-if';
import { arch, endianness, platform } from 'os';
import { addTests } from '../../zigar-compiler/test/integration/index.js';

for (const optimize of [ 'Debug', 'ReleaseSmall', 'ReleaseSafe', 'ReleaseFast' ]) {
  skip.permanently.if(process.env.npm_lifecycle_event === 'coverage').
  describe(`Integration tests (bun-zigar, ${optimize})`, function() {
    addTests((path, options) => importModule(path, { optimize, ...options }), {
      littleEndian: endianness() === 'LE',
      addressSize: /64/.test(arch()) ? 64 : 32,
      target: platform(),
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
    useRedirection = true,
    useLLVM = null,
  } = options;
  currentModule?.__zigar?.abandon();
  global.__test_options = {
    optimize,
    multithreaded,
    omitFunctions,
    omitVariables,
    useRedirection,
    useLLVM,
  };
  const module = await import(path);
  if (!options.preserve) {
    currentModule = module;
  }
  return module;
}
