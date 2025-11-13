import { mixin } from '../environment.js';
import { isPromise } from '../utils.js';

export default mixin({
  init() {
    this.nextThreadId = 1;
    this.workers = [];
  },
  getThreadHandler(name) {
    switch (name) {
      case 'thread-spawn':
        /* c8 ignore start */
        if (typeof(window) === 'object' && !window.crossOriginIsolated) {
          console.warn(
            '%cHTML document is not cross-origin isolated %c\n\nWebAssembly multithreading in the browser is only possibly when %cwindow.crossOriginIsolated%c = true. Visit https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated for information on how to enable it.',
            'color: red;font-size: 200%;font-weight:bold', '', 'background-color: lightgrey;font-weight:bold', ''
          );
        }
        /* c8 ignore end */
        return this.spawnThread.bind(this);
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
        // add a true argument to indicate that waiting is possible
        const result = fn?.(...args, true);
        const finish = (value) => {
          if (array) {
            array[1] = value|0;
            array[0] = 1;
            Atomics.notify(array, 0, 1);
          }
        };
        if (isPromise(result)) {
          result.then(finish);
        } else {
          finish(result);
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
      const worker = new Worker(url, { name: 'zig' });
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
  /* c8 ignore start */
  ...(process.env.DEV ? {
    diagWorkerSupport() {
      this.showDiagnostics('Worker support', [
        `Worker count: ${this.workers.length}`,
        `Next thread id: ${this.nextThreadId}`,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
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
  let postMessage, exit;

  if (typeof(self) === 'object' || process.env.COMPAT !== 'node') {
    // web worker
    self.onmessage = evt => run(evt.data);
    postMessage = msg => self.postMessage(msg);
    exit = () => self.close();
  } else if (process.env.COMPAT === 'node') {
    // Node.js worker-thread
    import(/* webpackIgnore: true */ 'worker_threads').then(({ parentPort, workerData }) => {
      postMessage = msg => parentPort.postMessage(msg);
      exit = () => process.exit();
      run(workerData);
    });
  }

  function run({ executable, memory, options, tid, arg }) {
    const w = WebAssembly;
    const env = { memory }, wasi = {}, wasiPreview = {};
    const imports = { env, wasi, wasi_snapshot_preview1: wasiPreview };
    for (const { module, name, kind } of w.Module.imports(executable)) {
      if (kind === 'function') {        
        const f = (name === 'proc_exit') ? () => {
          throw new Error('termination');
        } : createRouter(module, name);
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
    // catch thread termination exception
    try {
      wasi_thread_start(tid, arg);
    } catch {
    }
    postMessage({ type: 'exit' });
    exit();
  }

  function createRouter(module, name) {
    const array = new Int32Array(new SharedArrayBuffer(8));
    return function(...args) {
      array[0] = 0;
      postMessage({ type: 'call', module, name, args, array });
      Atomics.wait(array, 0, 0);
      return array[1];
    };
  }
}
/* c8 ignore end */
