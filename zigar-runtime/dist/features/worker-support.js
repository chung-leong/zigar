import { mixin } from '../environment.js';
import { remove, isPromise } from '../utils.js';

var workerSupport = mixin({
  init() {
    this.nextThreadId = 1;
    this.workers = [];
  },
  getThreadHandler(name) {
    switch (name) {
      case 'thread-spawn':
        if (typeof(window) === 'object' && !window.crossOriginIsolated) {
          console.warn(
            '%cHTML document is not cross-origin isolated %c\n\nWebAssembly multithreading in the browser is only possibly when %cwindow.crossOriginIsolated%c = true. Visit https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated for information on how to enable it.',
            'color: red;font-size: 200%;font-weight:bold', '', 'background-color: lightgrey;font-weight:bold', ''
          );
        }
        return this.spawnThread.bind(this);
      case 'thread-cancel':
        return this.cancelThread.bind(this);
      case 'thread-address':
        return this.getThreadAddress.bind(this);
    }
  },
  spawnThread(taddr) {
    const tid = this.nextThreadId++;
    if (this.nextThreadId === 0x4000_0000) {
      this.nextThreadId = 1;
    }
    const worker = this.createWorker();
    worker.run(tid, taddr);
    return tid;
  },
  cancelThread(tid, raddr) {
    const worker = this.workers.find(w => w.tid === tid);
    if (worker) {
      if (!raddr) {
        // defer termination until thread reaches a cancellation point
        worker.canceled = true;
      } else {
        worker.end(true);
        // create a replacement worker that'll perform the thread clean-up
        const scab = this.createWorker();
        scab.clean(raddr);
      }
    }
  }, 
  getThreadAddress(tid) {
    const worker = this.workers.find(w => w.tid === tid);
    return worker.taddr;
  },
  createWorker() {
    const handler = (msg) => {
      switch (msg.type) {
        case 'call': {
          const { module, name, args, futex } = msg;        
          if (!worker.canceled) {
            const fn = this.exportedModules[module]?.[name];
            // add a true argument to indicate that waiting is possible
            const result = fn?.(...args, true);
            const finish = (value) => worker.signal(futex, 1, value);
            if (isPromise(result)) {
              result.then(finish);
            } else {
              finish(result);
            }
          } else {
            // a deferred cancellation has occurred; set canceled to false so that debug print 
            // works during the clean-up process
            worker.canceled = false;
            worker.signal(futex, 2);
          }
        } break;
        case 'done': {
          worker.end();
        } break;
      }
    };
    let worker;
    if (typeof(Worker) === 'function') {
      // web worker
      const url = getWorkerURL();
      worker = new Worker(url, { name: 'zig' });
      worker.addEventListener('message', evt => handler(evt.data));
    }
    // send WebAssembly start-up data
    const { executable, memory, options } = this;
    worker.postMessage({ type: 'start', executable, memory, options });
    worker.signal = (futex, response, result) => {
      if (Atomics.load(futex, 0) === 0) {
        Atomics.store(futex, 0, response);
        Atomics.store(futex, 1, result|0);
        Atomics.notify(futex, 0, 1);
      }
    };
    worker.run = (tid, taddr) => {
      worker.tid = tid;
      worker.taddr = taddr;
      worker.canceled = false;
      worker.postMessage({ type: 'run', tid, taddr });
    };
    worker.clean = (raddr) => {
      worker.postMessage({ type: 'clean', raddr });
    };
    worker.end = (force = false) => {
      if (force) {
        worker.terminate();
      } else {
        worker.postMessage({ type: 'end' });
      }
      remove(this.workers, worker);
    };
    this.workers.push(worker);
    return worker;
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
    workerURL = URL.createObjectURL(new Blob([ code ], { type: 'text/javascript' }));
  }
  return workerURL;
}

function workerMain() {
  // this code must be entirely self-contained; don't call any imported functions
  const WA = WebAssembly;
  let port, instance;

  {
    // web worker
    self.onmessage = (evt) => process(evt.data);
    port = self;
  }

  function process(msg) {
    switch (msg.type) {
      case 'start': {
        const { executable, memory, options } = msg;
        const imports = { 
          env: { memory },
          wasi: {},
          wasi_snapshot_preview1: {},
        };
        const exit = () => { throw new Error('Exit') };
        const wait = (futex, timeout) => {
          const result = Atomics.wait(futex, 0, 0, timeout);
          if (result !== 'timed-out') {
            if (Atomics.load(futex, 0) === 2) {
              // was canceled in the middle of a call; jump back jump back into Zig to execute 
              // cleanup routines and TLS destructors then exit
              instance.exports.wasi_thread_clean(0);
              exit();
            }
            return Atomics.load(futex, 1);
          } else {
            return 0;
          }
        };
        const createFutex = () => new Int32Array(new SharedArrayBuffer(8));
        for (const { module, name, kind } of WA.Module.imports(executable)) {
          const ns = imports[module];
          if (kind === 'function' && ns) {
            ns[name] = (name === 'proc_exit') ? exit : function(...args) {
              const futex = createFutex();
              port.postMessage({ type: 'call', module, name, args, futex });
              return wait(futex);
            };
            if (name === 'fd_write') {
              const write = ns[name];
              ns[name] = function(fd, iovsAddress, iovsCount, writtenAddress) {                
                if (fd === 2) {
                  // get the total length first
                  const dv = new DataView(memory.buffer);
                  let total = 0;
                  const ops = [];
                  for (let i = 0, offset = 0; i < iovsCount; i++, offset += 8) {
                    const ptr = dv.getUint32(iovsAddress + offset, true);
                    const len = dv.getUint32(iovsAddress + offset + 4, true);
                    ops.push({ ptr, len });
                    total += len;
                  }
                  const array = new Uint8Array(total);
                  // copy vectors into new array
                  let pos = 0;
                  for (const { ptr, len } of ops) {
                    const vector = new Uint8Array(dv.buffer, ptr, len);
                    array.set(vector, pos);
                    pos += len;
                  }
                  const futex = createFutex();
                  port.postMessage({ 
                    type: 'call', 
                    module, 
                    name: `${name}_stderr`, 
                    args: [ array ],
                    futex,
                  }, [ array.buffer ]);
                  // write the length, assuming the operation will succeed in the main thread
                  dv.setUint32(writtenAddress, total, true);
                  // block for only up to 50ms
                  return wait(futex, 50000);
                } else {
                  return write(fd, iovsAddress, iovsCount, writtenAddress);
                }
              };
            }
          }
        }
        if (options.tableInitial) {
          imports.env.__indirect_function_table = new WA.Table({
            initial: options.tableInitial,
            element: 'anyfunc',
          });
        }
        instance = new WA.Instance(executable, imports);
      } break;
      case 'run': {
        // catch thread termination exception
        try {
          instance.exports.wasi_thread_start(msg.tid, msg.taddr);
        } catch {
        }
        port.postMessage({ type: 'done' });
      } break;
      case 'clean': {
        try {
          instance.exports.wasi_thread_clean(msg.raddr);
        } catch {
        }
        port.postMessage({ type: 'done' });
      } break;
      case 'end': {
        port.close();
      } break;
    }
  }
}

export { workerSupport as default };
