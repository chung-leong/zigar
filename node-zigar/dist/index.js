import { createRequire } from 'module';
import { createEnvironment } from 'node-zigar-addon';
import { arch, platform } from 'os';
import { dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  addPlatformExt, compile, extractOptions, findConfigFile, findSourceFile, generateCode,
  getCachePath, loadConfigFile, optionsForCompile
} from 'zigar-compiler';

function isZig(url) {
  const { pathname } = new URL(url);
  return extensionsRegex.test(pathname);
}

async function importModule(soPath, options) {
  const {
    omitFunctions = false,
    omitVariables = false,
  } = options;
  const env = createEnvironment();
  env.loadModule(soPath);
  env.acquireStructures({ omitFunctions, omitVariables });
  const definition = env.exportStructures();
  const require = createRequire(import.meta.url);
  // get the absolute path to node-zigar-addon so the transpiled code can find it
  const runtimeURL = pathToFileURL(require.resolve('node-zigar-addon'));
  const binarySource = env.hasMethods() ? JSON.stringify(soPath) : undefined;
  const { code } = generateCode(definition, { runtimeURL, binarySource });
  return {
    format: 'module',
    shortCircuit: true,
    source: code,
  };
}

export async function resolve(specifier, context, nextResolve) {
  return nextResolve(specifier);
}

const extensionsRegex = /\.(zig|zigar)(\?|$)/;

export async function load(url, context, nextLoad) {
  const m = extensionsRegex.exec(url);
  if (!m) {
    return nextLoad(url);
  }
  const path = fileURLToPath(url);
  const options = {
    clean: process.env.NODE_ENV === 'production',
    optimize: (process.env.NODE_ENV === 'production') ? 'ReleaseFast' : 'Debug',
    nativeCpu: true,
    platform: platform(),
    arch: arch(),
  };
  const configPath = await findConfigFile('node-zigar.config.json', dirname(path));
  if (configPath) {
    // add options from config file
    Object.assign(options, await loadConfigFile(configPath));
  }
  if (m[2]) {
    // allow overriding of options using query variables
    Object.assign(options, extractOptions(new URL(url).searchParams, optionsForCompile));
  }
  const srcPath = (m[1] === 'zig') ? path : findSourceFile(path, options);
  const soPath = (m[1] === 'zig') ? getCachePath(path, options) : addPlatformExt(path, options);
  if (srcPath) {
    await compile(srcPath, soPath, options);
  }
  return importModule(soPath, options)
}

