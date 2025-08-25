import { buildAddon, createEnvironment, getLibraryPath, optionsForAddon } from 'node-zigar-addon';
import { dirname, extname, join, parse } from 'path';
import { cwd } from 'process';
import { pathToFileURL } from 'url';
import {
  compile, extractOptions, findConfigFile, findSourceFile, generateCode, getArch, getCachePath,
  getModuleCachePath, getPlatform, loadConfigFile, normalizePath, optionsForCompile
} from 'zigar-compiler';
import { hideStatus, showStatus } from './status.cjs';

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
  const availableOptions = { ...optionsForCompile,  ...optionsForAddon };
  const configPath = !archive 
  ? await findConfigFile('node-zigar.config.json', dirname(path)) 
  /* c8 ignore next */ 
  : null;
  if (configPath) {
    // add options from config file
    Object.assign(options, await loadConfigFile(configPath, availableOptions));
  }
  // allow overriding of options using query variables
  Object.assign(options, extractOptions(new URL(url).searchParams, availableOptions));
  const ext = extname(path);
  const useCode = ext === '.zig';
  const srcPath = (useCode) ? path : findSourceFile(path, options);
  const modPath = (useCode) ? getModuleCachePath(path, options) : path;
  const addonParentDir = (useCode) ? getCachePath(options) : dirname(path);
  const addonDir = join(addonParentDir, 'node-zigar-addon');
  const { optimizeAddon, ...compileOptions } = options;
  const addonOptions = { 
    // try recompiling the Node-API addon only if app is not stored in an archive
    // and we're loading a .zig or if there's a config file
    recompileAddon: !archive && (useCode || !!configPath) && options.recompile != false, 
    optimizeAddon,
    platform,
    arch,
  };
  if (!options.quiet) {
    const modName = parse(path).name;
    Object.assign(compileOptions, {
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
  const { outputPath } = await compile(srcPath, modPath, compileOptions);
  process.env.ADDON_PATH = addonPath;
  const env = createEnvironment();
  env.loadModule(outputPath, false);
  env.acquireStructures(options);
  const definition = env.exportStructures();
  // get the absolute path to node-zigar-addon so the transpiled code can find it
  const runtimeURL = pathToFileURL(getLibraryPath()).href;
  const binarySource = env.hasMethods() ? JSON.stringify(outputPath) : undefined;
  const envVariables = { ADDON_PATH: addonPath };
  const { code } = generateCode(definition, { runtimeURL, binarySource, envVariables });
  return {
    format: 'module',
    shortCircuit: true,
    source: code,
  };
}
