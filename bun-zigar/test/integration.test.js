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
  } = options;
  currentModule?.__zigar?.abandon();
  const query = `optimize=${optimize}&`
              + `multithreaded=${multithreaded ? 1 : 0}&`
              + `omit-functions=${omitFunctions ? 1 : 0}&`
              + `omit-variables=${omitVariables ? 1 : 0}&`
              + `use-redirection=${useRedirection ? 1 : 0}&`;
  global.__test_options = {
    optimize,
    multithreaded,
    omitFunctions,
    omitVariables,
    useRedirection,
  };
  const module = await import(path + '?' + query);
  if (!options.preserve) {
    currentModule = module;
  }
  return module;
}
