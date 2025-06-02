import { mixin } from '../environment.js';
import { checkInefficientAccess, TypeMismatch } from '../errors.js';
import { MEMORY } from '../symbols.js';
import { empty, usize } from '../utils.js';

export default mixin({
  init() {
    this.writerCallback = null;
    this.writerContextMap = new Map();
    this.nextWriterContextId = usize(0x2000);
  },
  // create AnyWriter struct for outbound call
  createWriter(writer) {
    if (writer instanceof WritableStreamDefaultWriter) {
      // create a handle referencing the writer 
      const writerId = this.nextWriterContextId++;
      const ptr = this.obtainZigView(writerId, 0, false);
      this.writerContextMap.set(writerId, { writer });
      writer.closed.catch(empty).then(() => this.writerContextMap.delete(writerId));
      // use the same callback for all writers
      let writeFn = this.writerCallback;
      if (!writeFn) {
        writeFn = this.writerCallback = async (ptr, buffer) => {
          const writerId = this.getViewAddress(ptr['*'][MEMORY]);
          const context = this.writerContextMap.get(writerId);
          if (!context) return 0;
          try {
            const view = buffer['*'][MEMORY];
            const src = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
            /* c8 ignore next */
            if (import.meta.env?.PROD !== true) {
              checkInefficientAccess(context, 'write', src.length);
            }
            const { writer } = context;
            await writer.write(new Uint8Array(src));
            return src.length;
          } catch (err) {
            this.writerContextMap.delete(writerId);
            throw err;
          }
        };
        this.destructors.push(() => this.freeFunction(writeFn));
      }
      return { context: ptr, writeFn };
    } else {
      if (typeof(writer) === 'object' && writer) {
        if('context' in writer && 'writeFn' in writer) return writer;
      }
      throw new TypeMismatch('WritableStreamDefaultWriter', writer);
    }
  },
});