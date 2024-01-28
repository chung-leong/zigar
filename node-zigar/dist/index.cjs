const Module = require('module');
const { importModule } = require('node-zigar-addon/cjs');
const os = require('os');
const { dirname } = require('path');
const { fileURLToPath, pathToFileURL } = require('url');
const { 
  compileSync, addPlatformExt, findConfigFileSync, findSourceFile, getCachePath, 
  loadConfigFileSync, optionsForCompile
} = require('zigar-compiler/cjs');

const extensionsRegex = /\.(zig|zigar)(\?|$)/;

Module._load = new Proxy(Module._load, {
  apply(target, self, args) {
    const [ request, parent ] = args;
    const m = extensionsRegex.exec(request);
    if (!m) {
      return Reflect.apply(target, self, args);
    }
    const url = new URL(request, pathToFileURL(parent.filename));
    const path = fileURLToPath(url);
    const options = {
      clean: process.env.NODE_ENV === 'production',
      optimize: (process.env.NODE_ENV === 'production') ? 'ReleaseFast' : 'Debug',
      nativeCpu: true,
      platform: os.platform(),
      arch: os.arch(),
    };
    const configPath = findConfigFileSync('node-zigar.config.json', dirname(path));
    if (configPath) {
      // add options from config file
      Object.assign(options, loadConfigFileSync(configPath, optionsForCompile));
    }
    if (m[2]) {
      // allow overriding of options using query variables
      Object.assign(options, extractOptions(url.searchParams, optionsForCompile));
    }
    const srcPath = (m[1] === 'zig') ? path : findSourceFile(path, options);
    const soPath = (m[1] === 'zig') ? getCachePath(path, options) : addPlatformExt(path, options);
    if (srcPath) {
      compileSync(srcPath, soPath, options);
    }
    return importModule(soPath, options); 
  }
});
