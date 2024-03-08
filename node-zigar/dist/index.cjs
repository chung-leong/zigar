const Module = require('module');
const { importModule } = require('node-zigar-addon/cjs');
const os = require('os');
const { dirname, join, relative } = require('path');
const { fileURLToPath, pathToFileURL } = require('url');
const { 
  compileSync, extractOptions, findConfigFileSync, findSourceFile, getArch, getModuleCachePath,
  getPlatform, loadConfigFileSync, optionsForCompile
} = require('zigar-compiler/cjs');

const extensionsRegex = /\.(zig|zigar)(\?|$)/;

function parseZigURL(url) {
  return extensionsRegex.exec(url);
}

Module._load = new Proxy(Module._load, {
  apply(target, self, args) {
    const [ request, parent ] = args;
    const m = parseZigURL(request);
    if (!m) {
      return Reflect.apply(target, self, args);
    }
    const url = new URL(request, pathToFileURL(parent.filename));
    const path = fileURLToPath(url);
    const options = {
      clean: false,
      optimize: 'Debug',
      nativeCpu: false,
      platform: getPlatform(),
      arch: getArch(),
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
    const modPath = (m[1] === 'zig') ? getModuleCachePath(path, options) : path;
    // srcPath can be undefined, in which case compile() will simply return the path to 
    // the matching so/dylib/dll file in modPath; basically, when node-zigar.config.json 
    // is absent, compilation does not occur
    const { outputPath } = compileSync(srcPath, modPath, options);
    const addonDir = join(dirname(modPath), 'node-zigar-addon');
    return importModule(outputPath, addonDir, options); 
  }
});
