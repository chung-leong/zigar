import { mixin } from '../environment.js';

export default mixin({
    nextThreadId: 1,
    workers: [],

    getThreadHandler(name) {
      switch (name) {
        case 'thread-spawn': return this.spawnThread.bind(this);
        case 'wait-async': return this.waitAsync.bind(this);
      }
    },
    spawnThread(arg) {
      const tid = this.nextThreadId;
      this.nextThreadId++;
      const { executable, memory, options } = this;
      const workerData = { executable, memory, options, tid, arg };
      const handler = (worker, msg) => {
        if (msg.type === 'call') {
          const { module, name, args, array } = msg;
          const fn = this.exportedModules[module]?.[name];
          const result = fn?.(...args);
          if (array) {
            array[1] = result|0;
            array[0] = 1;
            Atomics.notify(array, 0, 1);
          }
        } else if (msg.type === 'exit') {
          const index = this.workers.indexOf(worker);
          if (index !== -1) {
            worker.detach();
            this.workers.splice(index, 1);
          }
        }
      };
      const evtName = 'message';
      /* c8 ignore start */
      if (typeof(Worker) === 'function' || process.env.COMPAT !== 'node') {
        // web worker
        const url = getWorkerURL();
        const worker = new Worker(url, { type: 'module', name: 'zig' });
        const listener = evt => handler(worker, evt.data);
        worker.addEventListener(evtName, listener);
        worker.detach = () => worker.removeEventListener(evtName, listener);
        worker.postMessage(workerData);
        this.workers.push(worker);
      }
      /* c8 ignore end */
      else if (process.env.COMPAT === 'node') {
        // Node.js worker-thread
        import('worker_threads').then(({ Worker }) => {
          const code = getWorkerCode();
          const worker = new Worker(code, { workerData, eval: true });
          const listener = msg => handler(worker, msg);
          worker.on(evtName, listener);
          worker.detach = () => worker.off(evtName, listener);
          this.workers.push(worker);
        });
      }
      return tid;
    },
    waitAsync(tidAddress, cbIndex, arg) {
      const ta = new Int32Array(this.memory.buffer, tidAddress, 1);
      const tid = Atomics.load(ta, 0);
      const cb = this.table.get(cbIndex);
      const call = () => cb(arg);
      const result = (tid !== 0) ? Atomics.waitAsync(ta, 0, tid) : { async: false };
      if (result.async) {
        result.value.then(call);
      } else {
        call();
      }
    },
});

function getWorkerCode() {
  const s = workerMain.toString();
  const si = s.indexOf('{') + 1;
  const ei = s.lastIndexOf('}');
  return s.slice(si, ei);
}

let workerURL;

function getWorkerURL() {
  if (!workerURL) {
    const code = getWorkerCode();
    workerURL = URL.createObjectURL(new Blob([ code ], { type: 'text/javascript' }))
  }
  return workerURL;
}

/* c8 ignore start */
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
    postMessage({ type: 'exit' });
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
/* c8 ignore end */
