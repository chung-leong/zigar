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
  const workerURL = pathToFileURL(join(__dirname, 'worker.js'));
  const workerData = { url, 
    buffers: {
      length: new Int32Array(new SharedArrayBuffer(4)),
      data: new Uint8Array(new SharedArrayBuffer(1024)),
    }
  };
  const worker = new Worker(workerURL, { workerData });
  worker.workerData = workerData;
  return worker;
}

function awaitWorker(worker) {
  const { buffers: { length, data } } = worker.workerData;
  // wait for change to occur
  for (let i = 0; Atomics.wait(length, 0, 0, (i < 10) ? 10 : 50) === 'timed-out'; i++);
  const bytes = data.slice(0, length[0]);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(bytes));
}

exports.createRequire = Module.createRequire;
