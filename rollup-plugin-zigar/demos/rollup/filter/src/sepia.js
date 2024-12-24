import { createOutput, createOutputAsync, startThreadPool } from '../zig/sepia.zig';

export async function createImageData(src, params) {
  const { width, height } = src;
  const { dst } = await createOutput(width, height, { src }, params);
  return new ImageData(dst.data.clampedArray, width, height);
}

let poolStarted = false;

export async function createImageDataAsync(src, params) {
  if (!poolStarted) {
      startThreadPool(navigator.hardwareConcurrency);
      poolStarted = true;
  }
  const { width, height } = src;
  const { dst } = await am.call(signal => createOutputAsync(width, height, { src }, params, { signal }));
  return new ImageData(dst.data.clampedArray, width, height);
}

class AbortManager {
  currentOp = null;

  async call(cb) {
    const controller = new AbortController;
    const { signal } = controller;
    const prevOp = this.currentOp;
    const thisOp = this.currentOp = { controller, promise: null };
    if (prevOp) {
      // abort previous call and wait for promise rejection
      prevOp.controller.abort();
      await prevOp.promise?.catch(() => {});
    }
    if (signal.aborted) {
      // throw error now if the operation was aborted,
      // before the function is even called
      throw new Error('Aborted');
    }
    const result = await (this.currentOp.promise = cb?.(signal));
    if (thisOp === this.currentOp) {
      this.currentOp = null;
    }
    return result;
  }

  async stop() {
    await this.call(null);
  }
}
const am = new AbortManager();