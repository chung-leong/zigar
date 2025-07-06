import { mixin } from '../environment.js';
import { checkInefficientAccess } from '../errors.js';
import { MEMORY } from '../symbols.js';
import { isPromise, usize } from '../utils.js';

var reader = mixin({
  init() {
    this.readerCallback = null;
    this.readerMap = new Map();
    this.nextReaderId = usize(0x1000);
    if (import.meta.env?.PROD !== true) {
      this.readerProgressMap = new Map();
    }
  },
  // create AnyReader struct for outbound call
  createReader(arg) {
    // check if argument isn't already an AnyReader struct
    if (typeof(arg) === 'object' && arg) {
      if('context' in arg && 'readFn' in arg) return arg;
    }
    const reader = this.convertReader(arg);
    // create a handle referencing the reader 
    const readerId = this.nextReaderId++;
    const context = this.obtainZigView(readerId, 0, false);
    const onClose = reader.onClose = () => {
      this.readerMap.delete(readerId);
      if (import.meta.env?.PROD !== true) {
        this.readerProgressMap.delete(readerId);
      }
    };
    this.readerMap.set(readerId, reader);
    if (import.meta.env?.PROD !== true) {
      this.readerProgressMap.set(readerId, { bytes: 0, calls: 0 });
    }
    // use the same callback for all readers
    let readFn = this.readerCallback;
    if (!readFn) {
      const onError = (err) => {
        console.error(err);
        onClose();
        throw err;
      };
      readFn = this.readerCallback = (context, buffer) => {
        const readerId = this.getViewAddress(context['*'][MEMORY]);
        const reader = this.readerMap.get(readerId);
        if (!reader) return 0;    
        try {
          const dv = buffer['*'][MEMORY];
          const len = dv.byteLength;
          const onResult = (chunk) => {
            const len = chunk.length;
            const address = this.getViewAddress(buffer['*'][MEMORY]);
            this.moveExternBytes(chunk, address, true);
            return len;
          };
          if (import.meta.env?.PROD !== true) {
            const progress = this.readerProgressMap.get(readerId);
            checkInefficientAccess(progress, 'read', len);
          }
          const result = reader.read(len);          
          return isPromise(result) ? result.then(onResult).catch(onError) : onResult(result);
        } catch (err) {
          onError(err);
        }
      };
      this.destructors.push(() => this.freeFunction(readFn));
    }
    return { context, readFn };
  },
});

export { reader as default };
