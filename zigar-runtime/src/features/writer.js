import { mixin } from '../environment.js';
import { checkInefficientAccess } from '../errors.js';
import { MEMORY } from '../symbols.js';
import { isPromise, usize } from '../utils.js';

export default mixin({
  init() {
    this.writerCallback = null;
    this.writerMap = new Map();
    this.nextWriterContextId = usize(0x2000);
  },
  // create AnyWriter struct for outbound call
  createWriter(arg) {
    // check if argument isn't already an AnyWriter struct
    if (typeof(arg) === 'object' && arg) {
      if('context' in arg && 'writeFn' in arg) return arg;
    }
    const writer = this.convertWriter(arg);
    // create a handle referencing the writer 
    const writerId = this.nextWriterContextId++;
    const context = this.obtainZigView(writerId, 0, false);
    const onClose = writer.onClose = () => this.writerMap.delete(writerId);
    this.writerMap.set(writerId, writer);     
    // use the same callback for all writers
    let writeFn = this.writerCallback;
    if (!writeFn) {
      const onError = (err) => {
        onClose();
        throw err;
      };
      writeFn = this.writerCallback = (context, buffer) => {
        const writerId = this.getViewAddress(context['*'][MEMORY]);
        const writer = this.writerMap.get(writerId);
        if (!writer) return 0;
        try {
          const dv = buffer['*'][MEMORY];
          /* c8 ignore next */
          if (import.meta.env?.PROD !== true) {
            checkInefficientAccess(context, 'write', dv.byteLength);
          }
          const len = dv.byteLength;
          const src = new Uint8Array(dv.buffer, dv.byteOffset, len);
          const copy = new Uint8Array(src);
          const result = writer.write(copy);
          return isPromise(result) ? result.then(() => len, onError) : len;
        } catch (err) {
          onError(err);
        }
      };
      this.destructors.push(() => this.freeFunction(writeFn));
    }
    return { context, writeFn };
  },
});
