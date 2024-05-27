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
    const url = new URL(request, pathToFileURL(parent.filename)).href
    // start a worker so we can handle compilation in async code
    const buffers = {
      length: new Int32Array(new SharedArrayBuffer(4)),
      data: new Uint8Array(new SharedArrayBuffer(1024)),
    };
    const worker = startWorker(url);
    const { modulePath, addonPath } = awaitWorker(worker);
    // load the addon and create the runtime environment
    const { createEnvironment } = require(addonPath);
    const env = createEnvironment();
    env.loadModule(modulePath);
    env.acquireStructures({});
    return env.useStructures();
  }
});

function startWorker(url) {
  const workerURL = pathToFileURL(join(__dirname, 'worker.cjs'));
  const workerData = { url, 
    buffers: {
      status: new Int32Array(new SharedArrayBuffer(4)),
      length: new Int32Array(new SharedArrayBuffer(4)),
      data: new Uint8Array(new SharedArrayBuffer(10240)),
    }
  };
  const worker = new Worker(workerURL, { workerData });
  worker.workerData = workerData;
  return worker;
}

function awaitWorker(worker) {
  const { buffers: { status, length, data } } = worker.workerData;
  // wait for notification from worker
  try {
    Atomics.wait(status, 0, 0);
  } catch (err) {
    while (status[0] === 0);
  }
  const bytes = Buffer.from(data.buffer, 0, length[0]);
  const result = JSON.parse(bytes.toString()); 
  if (status[0] === 1) {
    return result;
  } else {
    throw new Error(result.error);
  }
}

exports.createRequire = Module.createRequire;
