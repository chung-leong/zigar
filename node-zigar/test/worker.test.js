import { expect } from 'chai';
import { Worker } from 'worker_threads';

describe('CommonJS worker', function() {
  it('should load compile Zig file and Node-API addon ', async function() {
    this.timeout(300000);
    const url = new URL('./zig-samples/simple.zig?quiet=1', import.meta.url).href;
    const worker = startWorker(url);
    await new Promise((resolve, reject) => {
      worker.on('error', reject);
      worker.on('exit', resolve);
    });
    const result = awaitWorker(worker);
    expect(result).to.have.property('addonPath');
    expect(result).to.have.property('modulePath');
  })
  it('should allow synchronous await', function() {
    this.timeout(300000);
    const url = new URL('./zig-samples/simple.zig?quiet=1', import.meta.url).href;
    const worker = startWorker(url);
    const result = awaitWorker(worker);
    expect(result).to.have.property('addonPath');
    expect(result).to.have.property('modulePath');
  })
})

function startWorker(url) {
  const workerURL = new URL('../dist/worker.js', import.meta.url);
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
  for (let i = 0; Atomics.wait(length, 0, 0, (i < 20) ? 10 : 50) === 'timed-out'; i++);
  if (length[0] > 0) {
    const bytes = data.slice(0, length[0]);
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(bytes)); 
  } else {
    throw new Error('Worker thread failed');
  }
}