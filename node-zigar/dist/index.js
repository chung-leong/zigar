import { createRequire } from 'module';
import { createEnvironment } from 'node-zigar-addon';
import { dirname, join } from 'path';
import { cwd } from 'process';
import { pathToFileURL } from 'url';
import {
  compile, extractOptions, findConfigFile, findSourceFile, generateCode, getArch, getCachePath,
  getModuleCachePath, getPlatform, loadConfigFile, normalizePath, optionsForCompile
} from 'zigar-compiler';

const baseURL = pathToFileURL(`${cwd()}/`).href;

export async function resolve(specifier, context, nextResolve) {
  const m = parseZigURL(specifier);
  if (!m) {
    return nextResolve(specifier);
  }
  const { parentURL = baseURL } = context;
  const { href } = new URL(specifier, parentURL);
  return {
    format: 'module',
    shortCircuit: true,
    url: href,
  };
}

const extensionsRegex = /\.(zig|zigar)(\?|$)/;

export function parseZigURL(url) {
  return extensionsRegex.exec(url);
}

export async function load(url, context, nextLoad) {
  const m = parseZigURL(url);
  if (!m) {
    return nextLoad(url);
  }
  const { path, archive } = normalizePath(url);
  const options = {
    clean: false,
    optimize: 'Debug',
    platform: getPlatform(),
    arch: getArch(),
  };
  if (!archive) {
    const configPath = await findConfigFile('node-zigar.config.json', dirname(path));
    if (configPath) {
      // add options from config file
      Object.assign(options, await loadConfigFile(configPath, optionsForCompile));
    }
  }
  if (m[2]) {
    // allow overriding of options using query variables
    Object.assign(options, extractOptions(new URL(url).searchParams, optionsForCompile));
  }
  const srcPath = (m[1] === 'zig') ? path : findSourceFile(path, options);
  const modPath = (m[1] === 'zig') ? getModuleCachePath(path, options) : path;
  // srcPath can be undefined, in which case compile() will simply return the path to 
  // the matching so/dylib/dll file in modPath; basically, when node-zigar.config.json 
  // is absent, compilation does not occur
  const { outputPath } = await compile(srcPath, modPath, options);
  const addonParentDir = (m[1] === 'zig') ? getCachePath(options) : dirname(path);
  const addonDir = join(addonParentDir, 'node-zigar-addon');
  const recompile = !archive;
  const env = createEnvironment({ addonDir, recompile });  
  env.loadModule(outputPath);
  env.acquireStructures(options);
  const definition = env.exportStructures();
  const require = createRequire(import.meta.url);
  // get the absolute path to node-zigar-addon so the transpiled code can find it
  const runtimeURL = pathToFileURL(require.resolve('node-zigar-addon'));
  const binarySource = env.hasMethods() ? JSON.stringify(outputPath) : undefined;
  const { code } = generateCode(definition, { runtimeURL, binarySource, addonDir });
  return {
    format: 'module',
    shortCircuit: true,
    source: code,
  };
}
