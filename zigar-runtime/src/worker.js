
let postMessage;

(async () => {
  if (typeof(self) === 'object') {
    // web worker
    onmessage = evt => start(evt.data);
    postMessage = msg => self.postMessage(msg);
  } else {
    // Node.js worker-thread
    const { parentPort, workerData } = await import('worker_threads');
    postMessage = msg => parentPort.postMessage(msg);
    start(workerData);
  }
})();

function start({ executable, memory, options, tid, arg }) {
  const w = WebAssembly;
  const env = { memory }, wasi = {}, wasiPreview = {};
  const imports = { env, wasi, wasi_snapshot_preview1: wasiPreview };
  for (const { module, name, kind } of w.Module.imports(executable)) {
    if (kind === 'function') {
      const f = createRouter(module, name);
      if (module === 'env') {
        env[name] = f;
      } else if (module === 'wasi_snapshot_preview1') {
        wasiPreview[name] = f;
      } else if (module === 'wasi') {
        wasi[name] = f;
      }
    }
  }
  const { tableInitial } = options;
  env.__indirect_function_table = new w.Table({
    initial: tableInitial,
    element: 'anyfunc',
  });
  const { exports } = new w.Instance(executable, imports);
  const { wasi_thread_start } = exports;
  wasi_thread_start(tid, arg);
}

function createRouter(module, name) {
  if (name === '_queueJsAction') {
    // waiting occurs in WASM when queueJsAction() gets called
    return function(...args) {
      postMessage({ type: 'call', module, name, args });
      return 0;
    };
  } else {
    const array = new Int32Array(new SharedArrayBuffer(8));
    return function(...args) {
      array[0] = 0;
      postMessage({ type: 'call', module, name, args, array });
      Atomics.wait(array, 0, 0);
      return array[1];
    };
  }
}