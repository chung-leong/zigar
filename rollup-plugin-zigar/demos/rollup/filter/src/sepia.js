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
  const { dst } = await atm.call(signal => createOutputAsync(width, height, { src }, params, { signal }));
  return new ImageData(dst.data, width, height);
}

class AsyncTaskManager {
  currentTask = null;

  async call(cb) {
    const controller = (cb?.length > 0) ? new AbortController : null;
    const promise = this.perform(cb, controller?.signal);
    const thisTask = this.currentTask = { controller, promise };
    try {
      return await thisTask.promise;
    } finally {
      if (thisTask === this.currentTask) this.currentTask = null;
    }
  }

  async perform(cb, signal) {
    if (this.currentTask) {
      this.currentTask.controller?.abort();
      await this.currentTask.promise?.catch(() => {});
      // throw error now if the task was aborted before the function is called
      if (signal?.aborted) throw new Error('Aborted');
    }
    return cb?.(signal);
  }
}
const atm = new AsyncTaskManager();
