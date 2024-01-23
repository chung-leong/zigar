const { createEnvironment } = require('node-zigar-addon/cjs');
const { cwd } = require('process');
const { fileURLToPath, pathToFileURL } = require('url');
const { compile } = require('zigar-compiler');

const baseURL = pathToFileURL(`${cwd()}/`).href;
const extensionsRegex = /\.zig$/;

function isZig(url) {
  const { pathname } = new URL(url);
  return extensionsRegex.test(pathname);
}

function importZig(url) {
  
}

Module.prototype.require = new Proxy(Module.prototype.require, {
  apply(target, self, [ url ]) {
    if (isZig(url)) {
      return importZig(url);
    }
    return Reflect.apply(target, self, args);
  }
});
