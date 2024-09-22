import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';
import { mixin } from '../environment.js';

export default mixin({
  ...(process.env.TARGET === 'wasm' ? {
    nextThreadId: 1,
    getThreadHandler() {
      return this.spawnThread.bind(this);
    },
    spawnThread(arg) {
      const tid = this.nextThreadId;
      this.nextThreadId++;
      const url = pathToFileURL('/home/cleong/zigar/zigar-runtime/src/worker.js');
      const { executable, memory, options } = this;
      const workerData = { executable, memory, options, tid, arg };
      const worker = new Worker(url, { workerData });
      worker.on('message', (msg) => {
        if (msg.type === 'call') {
          const { module, name, args, array } = msg;
          const fn = this.exportedModules[module]?.[name];
          array[1] = fn?.(...args) | 0;
          array[0] = 1;
          Atomics.notify(array, 0, 1);
        }
      });
      return tid;
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      setMultithread: null,
      finalizeAsyncCall: null,
    },
  } : undefined) ,
});
