import { buildAddon } from 'node-zigar-addon';
import { dirname, extname, join, parse } from 'path';
import { workerData } from 'worker_threads';
import {
  compile, extractOptions, findConfigFile, findSourceFile, getArch, getCachePath,
  getModuleCachePath, getPlatform, loadConfigFile, normalizePath, optionsForCompile,
} from 'zigar-compiler';
import { hideStatus, showStatus } from './status.js';

const { url, buffers } = workerData;
try {
  const { path, archive } = normalizePath(url);
  const platform = getPlatform();
  const arch = getArch();
  const options = {
    clean: false,
    optimize: 'Debug',
    quiet: false,
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
  // srcPath can be undefined, in which case compile() will simply return the path to 
  // the matching so/dylib/dll file in modPath; basically, when node-zigar.config.json 
  // is absent, compilation does not occur
  const { outputPath: modulePath } = await compile(srcPath, modPath, options);
  const json = JSON.stringify({ addonPath, modulePath });
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);
  for (let i = 0; i < bytes.length; i++) {
      buffers.data[i] = bytes[i];
  }
  buffers.length[0] = bytes.length; 
} catch (err) {
  console.error(err);
  buffers.length[0] = -1;
}
