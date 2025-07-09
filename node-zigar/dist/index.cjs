const Module = require('module');
const { join } = require('path');
const { Worker } = require('worker_threads');
const { pathToFileURL } = require('url');

const extensionsRegex = /\.(zig|zigar)(\?|$)/;

Module._load = new Proxy(Module._load, {
  apply(target, self, args) {
    const [ request, parent ] = args;
    if (!extensionsRegex.exec(request)) {
      return Reflect.apply(target, self, args);
    }
    const parentPath = parent.filename ?? /* c8 ignore next */ join(process.cwd(), 'script');
    const parentURL = pathToFileURL(parentPath);
    const url = new URL(request, parentURL).href
    // start a worker so we can handle compilation in async code
    const status = new Int32Array(new SharedArrayBuffer(4));
    const length = new Int32Array(new SharedArrayBuffer(4));
    const data = new Uint8Array(new SharedArrayBuffer(10240));
    const workerData = { url, buffers: { status, length, data, } };
    new Worker(join(__dirname, 'worker.cjs'), { workerData });
    // wait for notification from worker
    try {
      Atomics.wait(status, 0, 0);
      /* c8 ignore next 4 */
    } catch (err) {
      // NW.js doesn't allow Atomics.wait() in the main thread
      while (status[0] === 0);
    }
    const bytes = Buffer.from(data.buffer, 0, length[0]);
    const result = JSON.parse(bytes.toString());
    if (status[0] !== 1) {
      throw new Error(result.error);
    }
    const { modulePath, addonPath } = result;
    // load the addon and create the runtime environment
    const { createEnvironment } = require(addonPath);
    const env = createEnvironment();
    env.loadModule(modulePath, false);
    env.acquireStructures({});
    return env.useStructures();
  }
});

exports.createRequire = Module.createRequire;
