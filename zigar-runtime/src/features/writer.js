import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { MEMORY } from '../symbols.js';
import { empty, usize } from '../utils.js';

export default mixin({
  init() {
    this.writerCallback = null;
    this.writerMap = new Map();
    this.nextWriterId = usize(0x1000);
  },
  // create AnyWriter struct for outbound call
  createWriter(writer) {
    if (writer instanceof WritableStreamDefaultWriter) {
      // create a handle referencing the writer 
      const writerId = this.nextWriterId++;
      const context = this.obtainZigView(writerId, 0, false);
      this.writerMap.set(writerId, writer);
      writer.closed.catch(empty).then(() => this.writeMap.delete(writerId));
      // use the same callback for all writers
      let writeFn = this.writerCallback;
      if (!writeFn) {
        writeFn = this.writerCallback = async (context, buffer) => {
          const writerId = this.getViewAddress(context['*'][MEMORY]);
          const writer = this.writerMap.get(writerId);
          if (!writer) return 0;
          const view = buffer['*'][MEMORY];
          const array = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
          await writer.write(array);
          return array.length;
        };
        this.destructors.push(() => this.releaseFunction(this.getFunctionId(writeFn)));
      }
      return { context, writeFn };
    } else {
      if ('context' in writer && 'writeFn' in writer) {
        return writer;
      }      
      throw new TypeMismatch('WritableStreamDefaultWriter', writer);
    }
  },
});