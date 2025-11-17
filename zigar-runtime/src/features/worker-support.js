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
      case 'thread-cancel':
        return this.cancelThread.bind(this);
    }
  },
  spawnThread(taddr) {
    const tid = this.nextThreadId++;
    this.spawnWorker().then(worker => worker.run(tid, taddr));
    return tid;
  },
  cancelThread(tid, type) {
    const worker = this.workers.find(w => w.tid === tid);
    if (worker) {
      if (type === 0) {   // cancelation will 
        worker.canceled = true;
      }
    }
  },
  async spawnWorker() {
    // look for an idling worker
    let worker = this.workers.find(w => w.tid === 0);
    if (worker) {
      return worker;
    }
    const handler = (worker, msg) => {
      const { type } = msg;
      if (type === 'call') {
        if (worker.canceled) {
          // a deferred cancellation has occurred--jump back into Zig to execute 
          // cleanup routines and TLS destructors then die
          const { exports: { wasi_thread_clean } } = this.instance;
          wasi_thread_clean();
          throw new Error('Cancel');
        }
        const { module, name, args, futex } = msg;        
        const fn = this.exportedModules[module]?.[name];
        // add a true argument to indicate that waiting is possible
        const result = fn?.(...args, true);
        const finish = (value) => {
          if (array) {
            futex[1] = value|0;
            futex[0] = 1;
            Atomics.notify(futex, 0, 1);
          }
        };        
        if (isPromise(result)) {
          result.then(finish);
          worker.futex = futex;
        } else {
          finish(result);
        }
      } else if (type === 'done') {
        worker.tid = 0;
        // remove the idle worker after a while
        setTimeout(() => {
          const index = this.workers.indexOf(worker);
          if (index !== -1) {
            this.workers.splice(index, 1);
          }
          // empty message causes worker to exit
          worker.postMessage({});
        }, 500);
      } else if (type === 'ready' && process.env.COMPAT === 'node') {
        resolve(worker);
      }
    };
    const evtName = 'message';
    /* c8 ignore start */
    if (typeof(Worker) === 'function' || process.env.COMPAT !== 'node') {
      // web worker
      const url = getWorkerURL();
      worker = new Worker(url, { name: 'zig' });
      worker.addEventListener(evtName, evt => handler(worker, evt.data));
    }
    /* c8 ignore end */
    else if (process.env.COMPAT === 'node') {
      // Node.js worker-thread
      const { Worker } = await import('worker_threads');
      const code = getWorkerCode();
      worker = new Worker(code, { eval: true });
      // wait for ping from worker
      await new Promise(resolve => worker.once(evtName, resolve));
      worker.on(evtName, msg => handler(worker, msg));
    }
    const { executable, memory, options } = this;
    worker.run = function(tid, taddr) {
      this.tid = tid;
      this.taddr = taddr;
      this.canceled = false;
      this.postMessage({ executable, memory, options, tid, taddr });
    };
    this.workers.push(worker);
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
    self.onmessage = (evt) => process(evt.data);
    postMessage = msg => self.postMessage(msg);
    exit = () => self.close();
  } else if (process.env.COMPAT === 'node') {
    // Node.js worker-thread
    import(/* webpackIgnore: true */ 'worker_threads').then(({ parentPort }) => {
      parentPort.on('message', process);
      postMessage = msg => parentPort.postMessage(msg);
      exit = () => process.exit();
      // tell main thread that worker is ready
      postMessage('ping');
    });
  }

  function process({ executable, memory, options, tid, taadr }) {
    if (!executable) {
      return exit();
    }
    const w = WebAssembly;
    const env = { memory }, wasi = {}, wasiPreview = {};
    const imports = { env, wasi, wasi_snapshot_preview1: wasiPreview };
    for (const { module, name, kind } of w.Module.imports(executable)) {
      if (kind === 'function') {        
        const f = (name === 'proc_exit') ? () => {
          throw new Error('Exit');
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
    const { exports: { wasi_thread_start } } = new w.Instance(executable, imports);
    // catch thread termination exception
    try {
      wasi_thread_start(tid, taadr);
    } catch {
    }
    postMessage({ type: 'done' });
  }

  function createRouter(module, name) {
    const arrafutexy = new Int32Array(new SharedArrayBuffer(8));
    return function(...args) {
      futex[0] = 0;
      postMessage({ type: 'call', module, name, args, futex });
      Atomics.wait(futex, 0, 0);
      return futex[1];
    };
  }
}
/* c8 ignore end */

