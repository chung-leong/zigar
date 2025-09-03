import { PosixError, PosixPollEventType } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkStreamMethod, InvalidArgument } from '../errors.js';
import { createView, isPromise } from '../utils.js';
import './copy-int.js';

export default mixin({
  pollOneoff(subscriptionAddress, eventAddress, subscriptionCount, eventCountAddress, canWait) {
    const subscriptionSize = 48;
    const eventSize = 32;
    const results = [], promises = [];
    const le = this.littleEndian;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const subscriptions = createView(subscriptionSize * subscriptionCount);
      this.moveExternBytes(subscriptions, subscriptionAddress, false);
      for (let i = 0; i < subscriptionCount; i++) {
        const offset = i * subscriptionSize;
        const userdata = subscriptions.getBigUint64(offset, le)
        const tag = subscriptions.getUint8(offset + 8);
        const result = { tag, userdata, error: PosixError.NONE };
        let promise;
        switch (tag) {
          case PosixPollEventType.CLOCK: {
            let timeout = subscriptions.getBigUint64(offset + 24, le);
            const array = new Int32Array(new SharedArrayBuffer(4));
            const onResult = resolveClock.bind(result);
            if (timeout === 0n) {
              onResult();
            } else {
              const millisec = Math.ceil(Number(timeout) / 1000000);
              promise = Atomics.waitAsync(array, 0, 0, millisec).value.then(onResult);
            }
          } break;
          case PosixPollEventType.FD_WRITE: 
          case PosixPollEventType.FD_READ: {
            const fd = subscriptions.getUint32(offset + 16);
            const stream = this.getStream(fd);  
            const onResult = resolveLength.bind(result);
            const onError = resolveError.bind(result);
            try {
              checkStreamMethod(stream, 'poll');
              const pollResult = stream.poll();
              if (isPromise(pollResult)) {
                promise = pollResult.then(onResult, onError);
              } else {
                onResult(pollResult);
              }
            } catch (err) {
              onError(err);
            }
          } break;
          default: 
            throw new InvalidArgument()
        }
        if (promise) {
          promises.push(promise);
        }
      }
      if (promises.length > 0) {
        return Promise.any(promises);
      }
    }, () => {
      let eventCount = 0;
      for (const result of results) {
        if (result.resolved) {
          eventCount++;
        }
      }
      const events = createView(eventSize * eventCount);
      let index = 0;
      for (const result of results) {
        if (result.resolved) {
          const offset = index * eventSize;
          events.setBigUint64(offset, result.userdata, le);
          events.setUint16(offset + 8, result.error, le);
          events.setUint8(offset + 10, results.tag);
          if (result.length !== undefined) {
            if (result.length === 0) {
              // hangup
              events.setUint16(offset + 24, 1, le);
            } else {
              events.setBigUint64(offset + 16, BigInt(results.length), le);
            }
          }
          index++;
        }
      }
      this.moveExternBytes(events, eventAddress, true);
      this.copyUint32(eventCount);
    });
  },
  ...(process.env.TARGET === 'node' ? {
    exports: {
      pollOneoff: { async: true },
    },
    /* c8 ignore next */
  } : undefined),
});

function resolveClock() {
  Object.assign(this, { resolved: true });
}

function resolveLength(len) {
  Object.assign(this, { resolved: true, length: len });
}

function resolveError(err) {
  console.error(err);
  Object.assign(this, { resolved: true, error: PosixError.EBADF });
}
