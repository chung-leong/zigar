(async () => {
  const { buildAddon } = require('node-zigar-addon');
  const { dirname, extname, join, parse } = require('path');
  const { URL } = require('url');
  const {
    compile, extractOptions, findConfigFile, findSourceFile, getArch, getCachePath,
    getModuleCachePath, getPlatform, loadConfigFile, normalizePath, optionsForCompile,
  } = require('zigar-compiler/cjs');
  const { hideStatus, showStatus } = require('./status.cjs');
  const { workerData } = require('worker_threads');

  const { url, buffers } = workerData;
  let status = 0, result = null;
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
    result = { addonPath, modulePath };
    status = 1;
  } catch (err) {
    result = { error: err.message };
    status = 2;
  }
  const json = JSON.stringify(result);
  const bytes = Buffer.from(json);
  for (let i = 0; i < bytes.length; i++) {
      buffers.data[i] = bytes[i];
  }
  buffers.length[0] = bytes.length;
  buffers.status[0] = status;
  Atomics.notify(buffers.status, 0);
})();

