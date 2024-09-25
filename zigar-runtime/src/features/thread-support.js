import { mixin } from '../environment.js';

export default mixin({
  ...(process.env.TARGET === 'wasm' && process.env.MIXIN !== 'track' ? {
    imports: {
      finalizeAsyncCall: { argType: 'ii' },
    },
    nextThreadId: 1,

    getThreadHandler() {
      return this.spawnThread.bind(this);
    },
    spawnThread(arg) {
      const tid = this.nextThreadId;
      this.nextThreadId++;
      (async () => {
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
        // need to get the URL here so that the Node side isn't affected
        const { default: url } = await import('../worker.min.js');
        if (typeof(Worker) === 'function') {
          // web worker
          const worker = new Worker(url, { type: 'module', name: 'zig' });
          worker.onmessage = evt => handler(evt.data);
          worker.postMessage(workerData);
        } else {
          // Node.js worker-thread
          const { Worker } = await import('worker_threads');
          const buffer = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
          const code = buffer.toString();
          const worker = new Worker(code, { workerData, eval: true });
          worker.on('message', handler);
        }
      })();
      return tid;
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      setMultithread: null,
      finalizeAsyncCall: null,
    },
  } : undefined) ,
});
