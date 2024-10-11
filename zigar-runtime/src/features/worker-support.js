import { mixin } from '../environment.js';

export default mixin({
    nextThreadId: 1,

    getThreadHandler() {
      return this.spawnThread.bind(this);
    },
    spawnThread(arg) {
      const tid = this.nextThreadId;
      this.nextThreadId++;
      const { executable, memory, options } = this;
      const workerData = { executable, memory, options, tid, arg };
      const handler = (msg) => {
        if (msg.type === 'call') {
          const { module, name, args, array } = msg;
          const fn = this.exportedModules[module]?.[name];
          const result = fn?.(...args);
          if (array) {
            array[1] = result|0;
            array[0] = 1;
            Atomics.notify(array, 0, 1);
          }
        }
      };
      const code = getWorkerCode();
      if (typeof(Worker) === 'function' || process.env.COMPAT !== 'node') {
        // web worker
        const url = new URL('data:,' + encodeURIComponent(code));
        const worker = new Worker(url, { type: 'module', name: 'zig' });
        worker.onmessage = evt => handler(evt.data);
        worker.postMessage(workerData);
      } else if (process.env.COMPAT === 'node') {
        // Node.js worker-thread
        import('worker_threads').then(({ Worker }) => {
          const worker = new Worker(code, { workerData, eval: true });
          worker.on('message', handler);
        });
      }
      return tid;
    },
});

function getWorkerCode() {
  const s = workerMain.toString();
  const si = s.indexOf('{') + 1;
  const ei = s.lastIndexOf('}');
  return s.slice(si, ei);
}

function workerMain() {
  let postMessage;

  if (typeof(self) === 'object' || process.env.COMPAT !== 'node') {
    // web worker
    self.onmessage = evt => run(evt.data);
    postMessage = msg => self.postMessage(msg);
  } else if (process.env.COMPAT === 'node') {
    // Node.js worker-thread
    import('worker_threads').then(({ parentPort, workerData }) => {
      postMessage = msg => parentPort.postMessage(msg);
      run(workerData);
    });
  }

  function run({ executable, memory, options, tid, arg }) {
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
}
