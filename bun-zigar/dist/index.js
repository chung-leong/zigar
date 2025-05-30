import { plugin } from 'bun';
import { buildAddon, createEnvironment, getLibraryPath } from 'node-zigar-addon';
import { dirname, extname, join, parse } from 'path';
import { pathToFileURL } from 'url';
import {
  compile, findConfigFile, findSourceFile, generateCode, getArch, getCachePath, getModuleCachePath,
  getPlatform, normalizePath, optionsForCompile, processConfig,
} from 'zigar-compiler';
import { hideStatus, showStatus } from './status.js';

await plugin({
  name: "zigar",
  async setup(build) {
    build.onResolve({ filter: /\.(zig|zigar)($|\?)/ }, async ({ path, importer }) => {
      const parentURL = pathToFileURL(importer);
      const url = new URL(path, parentURL).href
      return { path: url, namespace: 'zigar' };
    })
    build.onResolve({ filter: /.*/, namespace: 'zigar' }, async ({ path }) => {
      return { path, namespace: 'zigar' };
    })
    build.onLoad({ filter: /.*/, namespace: 'zigar' }, async ({ path: url }) => {
      const { path } = normalizePath(url);
      const platform = getPlatform();
      const arch = getArch();
      const options = {
        clean: false,
        optimize: 'Debug',
        platform,
        arch,
      };
      const configPath = await findConfigFile('bun-zigar.toml', dirname(path));
      if (configPath) {
        // add options from config file
        const cfgModule = await import(configPath);
        Object.assign(options, processConfig(cfgModule.default, configPath, optionsForCompile));
      }
      const ext = extname(path);
      const srcPath = (ext === '.zig') ? path : findSourceFile(path, options);
      const modPath = (ext === '.zig') ? getModuleCachePath(path, options) : path;
      const addonParentDir = (ext === '.zig') ? getCachePath(options) : dirname(path);
      const addonDir = join(addonParentDir, 'node-zigar-addon');
      // build the Node-API addon if necessary
      const addonOptions = { 
        recompile: options.recompile !== false,
        platform,
        arch,
      };
      if (!options.quiet) {
        const modName = parse(path).name;
        Object.assign(options, {
          onStart: () => showStatus(`Building module "${modName}"`),
          onEnd: () => hideStatus(),
        });
        Object.assign(addonOptions, {
          onStart: () => showStatus(`Building Bun.js addon (${platform}/${arch})`),
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
      return {
        contents: code,
        loader: 'js',
      };
    });
  },
});