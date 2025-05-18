import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { MEMORY } from '../symbols.js';
import { empty, usize } from '../utils.js';

export default mixin({
  init() {
    this.readerCallback = null;
    this.readerMap = new Map();
    this.nextReaderId = usize(0x1000);
  },
  // create AnyReader struct for outbound call
  createReader(reader) {
    if (reader instanceof ReadableStreamDefaultReader || reader instanceof ReadableStreamBYOBReader) {
      // create a handle referencing the reader 
      const readerId = this.nextReaderId++;
      const context = this.obtainZigView(readerId, 0, false);
      this.readerMap.set(readerId, reader);
      // use the same callback for all readers
      let readFn = this.readerCallback;
      if (!readFn) {
        readFn = this.readerCallback = async (context, buffer) => {
          const readerId = this.getViewAddress(context['*'][MEMORY]);
          const reader = this.readerMap.get(readerId);
          if (!reader) return 0;
          try {
            const view = buffer['*'][MEMORY];
            const dest = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
            let finished = false, read = 0;
            if (reader instanceof ReadableStreamBYOBReader) {
              const { done, value } = await reader.read(dest);
              read = value.byteLength;
              finished = done;
              return ;
            } else {
              let leftover = reader.leftover;
              while (read < dest.length && !finished) {
                if (!leftover) {
                  const { done, value } = await reader.read();
                  reader.finished = done;
                  leftover = new Uint8Array(value);
                } 
                const len = Math.min(leftover.length, dest.length - read);
                for (let i = 0; i < len; i++) dest[read + i] = leftover[i]; 
                read += len;
                if (leftover.length > len) {
                  leftover = leftover.slice(len);
                } else {
                  leftover = null;
                  if (reader.finished) break;
                }
              }
              reader.leftover = leftover;
            }
            if (finished) {
              this.readerMap.delete(readerId);
            }
            return read;
          } catch (err) {
            this.readMap.delete(readerId);
            throw err;
          }
        };
        this.destructors.push(() => this.freeFunction(readFn));
      }
      return { context, readFn };
    } else {
      if (typeof(reader) === 'object' && 'context' in reader && 'readFn' in reader) {
        return reader;
      }      
      throw new TypeMismatch('ReadableStreamDefaultReader or ReadableStreamBYOBReader', reader);
    }
  },
});