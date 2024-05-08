import { buildAddon, createEnvironment, getLibraryPath } from 'node-zigar-addon';
import { dirname, extname, join } from 'path';
import { cwd } from 'process';
import { pathToFileURL } from 'url';
import {
  compile, extractOptions, findConfigFile, findSourceFile, generateCode, getArch, getCachePath,
  getModuleCachePath, getPlatform, loadConfigFile, normalizePath, optionsForCompile
} from 'zigar-compiler';

const baseURL = pathToFileURL(`${cwd()}/`).href;
const extensionsRegex = /\.(zig|zigar)(\?|$)/;

export async function resolve(specifier, context, nextResolve) {
  if (!extensionsRegex.test(specifier)) {
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

export async function load(url, context, nextLoad) {
  if (!extensionsRegex.test(url)) {
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
  // allow overriding of options using query variables
  Object.assign(options, extractOptions(new URL(url).searchParams, optionsForCompile));
  const ext = extname(path);
  const srcPath = (ext === '.zig') ? path : findSourceFile(path, options);
  const modPath = (ext === '.zig') ? getModuleCachePath(path, options) : path;
  const addonParentDir = (ext === '.zig') ? getCachePath(options) : dirname(path);
  const addonDir = join(addonParentDir, 'node-zigar-addon');
  // build the Node-API addon if necessary
  const addonPath = buildAddon({ addonDir, recompile: !archive });
  // compile the module if srcPath isn't undefined; if it is, then compile() will simply return 
  // the path to the matching so/dylib/dll file in modPath; basically, when node-zigar.config.json
  // is absent, compilation does not occur
  const { outputPath } = await compile(srcPath, modPath, options);
  const env = createEnvironment({ addonPath });  
  env.loadModule(outputPath);
  env.acquireStructures(options);
  const definition = env.exportStructures();
  // get the absolute path to node-zigar-addon so the transpiled code can find it
  const runtimeURL = getLibraryPath();
  const binarySource = env.hasMethods() ? JSON.stringify(outputPath) : undefined;
  const envOptions = { addonPath };
  const { code } = generateCode(definition, { runtimeURL, binarySource, envOptions });
  return {
    format: 'module',
    shortCircuit: true,
    source: code,
  };
}
