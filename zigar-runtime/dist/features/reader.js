import { mixin } from '../environment.js';
import { checkInefficientAccess, TypeMismatch } from '../errors.js';
import { MEMORY } from '../symbols.js';
import { usize } from '../utils.js';

var reader = mixin({
  init() {
    this.readerCallback = null;
    this.readerContextMap = new Map();
    this.nextReaderContextId = usize(0x1000);
  },
  // create AnyReader struct for outbound call
  createReader(reader) {
    if (reader instanceof ReadableStreamDefaultReader || reader instanceof ReadableStreamBYOBReader) {
      // create a handle referencing the reader 
      const contextId = this.nextReaderContextId++;
      const ptr = this.obtainZigView(contextId, 0, false);
      this.readerContextMap.set(contextId, { reader, leftover: null, finished: false });
      // use the same callback for all readers
      let readFn = this.readerCallback;
      if (!readFn) {
        readFn = this.readerCallback = async (ptr, buffer) => {
          const contextId = this.getViewAddress(ptr['*'][MEMORY]);
          const context = this.readerContextMap.get(contextId);
          if (!context) return 0;    
          try {
            const view = buffer['*'][MEMORY];
            const dest = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);            
            if (!import.meta.env.PROD) {
              checkInefficientAccess(context, 'reader', dest.length);
            }
            let { reader, finished, leftover } = context;
            let read = 0;
            if (reader instanceof ReadableStreamBYOBReader) {
              const { done, value } = await reader.read(dest);
              read = value.byteLength;
              finished = done;
            } else {
              while (read < dest.length && !finished) {
                if (!leftover) {
                  const { done, value } = await reader.read();
                  finished = done;
                  leftover = new Uint8Array(value);
                } 
                const len = Math.min(leftover.length, dest.length - read);
                for (let i = 0; i < len; i++) dest[read + i] = leftover[i]; 
                read += len;
                if (leftover.length > len) {
                  leftover = leftover.slice(len);
                } else {
                  leftover = null;
                  if (finished) break;
                }
              }
              context.leftover = leftover;
              context.finished = finished;
            }
            if (finished) {
              this.readerContextMap.delete(contextId);
            }
            return read;
          } catch (err) {
            console.error(err);
            this.readerContextMap.delete(contextId);
            throw err;
          }
        };
        this.destructors.push(() => this.freeFunction(readFn));
      }
      return { context: ptr, readFn };
    } else {
      if (typeof(reader) === 'object' && 'context' in reader && 'readFn' in reader) {
        return reader;
      }      
      throw new TypeMismatch('ReadableStreamDefaultReader or ReadableStreamBYOBReader', reader);
    }
  },
});

export { reader as default };
