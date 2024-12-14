import { expect } from 'chai';
import { Worker } from 'worker_threads';

describe('CommonJS worker', function() {
  it('should load compile Zig file and Node-API addon ', async function() {
    this.timeout(0);
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
    this.timeout(0);
    const url = new URL('./zig-samples/simple.zig?quiet=1', import.meta.url).href;
    const worker = startWorker(url);
    const result = awaitWorker(worker);
    expect(result).to.have.property('addonPath');
    expect(result).to.have.property('modulePath');
  })
  it('should throw when file does not exist', function() {
    const url = new URL('./zig-samples/missing.zig', import.meta.url).href;
    const worker = startWorker(url);
    expect(() => awaitWorker(worker)).to.throw(Error)
      .with.property('message').that.contains('no such file or directory');
  })
})

function startWorker(url) {
  const workerURL = new URL('../dist/worker.cjs', import.meta.url);
  const workerData = { url,
    buffers: {
      status: new Int32Array(new SharedArrayBuffer(4)),
      length: new Int32Array(new SharedArrayBuffer(4)),
      data: new Uint8Array(new SharedArrayBuffer(1024)),
    }
  };
  const worker = new Worker(workerURL, { workerData });
  worker.workerData = workerData;
  return worker;
}

function awaitWorker(worker) {
  const { buffers: { status, length, data } } = worker.workerData;
  // wait for change to occur
  for (let i = 0; Atomics.wait(status, 0, 0, (i < 20) ? 10 : 50) === 'timed-out'; i++);
  const bytes = Buffer.from(data.buffer, 0, length[0]);
  const result = JSON.parse(bytes.toString());
  if (status[0] === 1) {
    return result;
  } else {
    throw new Error(result.error);
  }
}
