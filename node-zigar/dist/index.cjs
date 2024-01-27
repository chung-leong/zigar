const { importModule } = require('node-zigar-addon/cjs');
const { cwd } = require('process');
const { fileURLToPath, pathToFileURL } = require('url');
const { compileSync } = require('zigar-compiler/cjs');
const Module = require('module');

const baseURL = pathToFileURL(`${cwd()}/`).href;
const srcExtRegEx = /\.zig$/;

function importZig(url) {
  const {
    omitFunctions = false,
    omitVariables = isElectron(),
    ...compileOptions
  } = options;
  const zigPath = fileURLToPath(url);
  const soPath = compileSync(zigPath, compileOptions);
  return importModule(soPath);
}

Module._load = new Proxy(Module._load, {
  apply(target, self, args) {
    const [ request, parent ] = args;
    const url = new URL(request, pathToFileURL(parent.filename));
    if (srcExtRegEx.test(url.pathname)) {
      return importZig(url);
    }
    return Reflect.apply(target, self, args);
  }
});

export function isElectron() {
  return typeof(process) === 'object' 
      && typeof(process?.versions) === 'object' 
      && !!process.versions?.electron;
}

export function camelCase(name) {
  return name.toLowerCase().replace(/_(\w)/g, (m0, m1) => m1.toUpperCase());
}
