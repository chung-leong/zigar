import { createRequire } from 'module';
import { createEnvironment } from 'node-zigar-addon';
import os from 'os';
import { dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  addPlatformExt, compile, extractOptions, findConfigFile, findSourceFile, generateCode,
  getCachePath, loadConfigFile, optionsForCompile
} from 'zigar-compiler';

export async function resolve(specifier, context, nextResolve) {
  return nextResolve(specifier, context);
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
  const path = fileURLToPath(url);
  const options = {
    clean: false,
    optimize: 'Debug',
    nativeCpu: true,
    platform: os.platform(),
    arch: os.arch(),
  };
  const configPath = await findConfigFile('node-zigar.config.json', dirname(path));
  if (configPath) {
    // add options from config file
    Object.assign(options, await loadConfigFile(configPath, optionsForCompile));
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
  const env = createEnvironment();
  env.loadModule(soPath);
  env.acquireStructures(options);
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

