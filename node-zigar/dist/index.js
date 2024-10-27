import { buildAddon, createEnvironment, getLibraryPath } from 'node-zigar-addon';
import { dirname, extname, join, parse } from 'path';
import { cwd } from 'process';
import { pathToFileURL } from 'url';
import {
  compile, extractOptions, findConfigFile, findSourceFile, generateCode, getArch, getCachePath,
  getModuleCachePath, getPlatform, loadConfigFile, normalizePath, optionsForCompile
} from 'zigar-compiler';
import { hideStatus, showStatus } from './status.js';

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
    return nextLoad(url, context);
  }
  const { path, archive } = normalizePath(url);
  const platform = getPlatform();
  const arch = getArch();
  const options = {
    clean: false,
    optimize: 'Debug',
    platform,
    arch,
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
  const addonOptions = { recompile: !archive };
  if (!options.quiet) {
    const modName = parse(path).name;
    Object.assign(options, {
      onStart: () => showStatus(`Building module "${modName}"`),
      onEnd: () => hideStatus(),
    });
    Object.assign(addonOptions, {
      onStart: () => showStatus(`Building Node.js addon (${platform}/${arch})`),
      onEnd: () => hideStatus(),
    });
  }
  const { outputPath: addonPath } = await buildAddon(addonDir, addonOptions);
  // compile the module if srcPath isn't undefined; if it is, then compile() will simply return
  // the path to the matching so/dylib/dll file in modPath; basically, when node-zigar.config.json
  // is absent, compilation does not occur
  const { outputPath } = await compile(srcPath, modPath, options);
  process.env.ADDON_PATH = addonPath;
  const env = createEnvironment();
  env.loadModule(outputPath);
  env.acquireStructures(options);
  const definition = env.exportStructures();
  // get the absolute path to node-zigar-addon so the transpiled code can find it
  const runtimeURL = pathToFileURL(getLibraryPath()).href;
  const binarySource = env.hasMethods() ? JSON.stringify(outputPath) : undefined;
  const envVariables = { ADDON_PATH: addonPath };
  const { code } = generateCode(definition, { runtimeURL, binarySource, envVariables });
  // console.log(code);
  return {
    format: 'module',
    shortCircuit: true,
    source: code,
  };
}
