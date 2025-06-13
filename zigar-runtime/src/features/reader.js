import { mixin } from '../environment.js';
import { checkInefficientAccess } from '../errors.js';
import { MEMORY } from '../symbols.js';
import { isPromise, usize } from '../utils.js';

export default mixin({
  init() {
    this.readerCallback = null;
    this.readerMap = new Map();
    this.nextReaderId = usize(0x1000);
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
    const onClose = reader.onClose = () => this.readerMap.delete(readerId);
    this.readerMap.set(readerId, reader);
    // use the same callback for all readers
    let readFn = this.readerCallback;
    if (!readFn) {
      const onError = (err) => {
        onClose();
        throw err;
      };
      readFn = this.readerCallback = (context, buffer) => {
        const readerId = this.getViewAddress(context['*'][MEMORY]);
        const reader = this.readerMap.get(readerId);
        if (!reader) return 0;    
        try {
          const dv = buffer['*'][MEMORY];
          const dest = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
          /* c8 ignore next */
          if (import.meta.env?.PROD !== true) {
            checkInefficientAccess(context, 'read', dest.length);
          }
          const result = reader.read(dest);
          return isPromise(result) ? result.catch(onError) : result;
        } catch (err) {
          onError(err);
        }
      };
      this.destructors.push(() => this.freeFunction(readFn));
    }
    return { context, readFn };
  },
});
