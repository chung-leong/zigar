import { buildAddon } from 'node-zigar-addon';
import { dirname, extname, join } from 'path';
import { workerData } from 'worker_threads';
import {
  compile, extractOptions, findConfigFile, findSourceFile, getArch, getCachePath,
  getModuleCachePath, getPlatform, loadConfigFile, normalizePath, optionsForCompile,
} from 'zigar-compiler';

const { url, buffers } = workerData;
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
const addonPath = await buildAddon({ addonDir, recompile: !archive });
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
