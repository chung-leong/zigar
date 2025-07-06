import { mixin } from '../environment.js';
import { createView } from '../utils.js';

var copyUsize = mixin({
  copyUsize(bufAddress, value) {
    {
      this.copyUint32(bufAddress, value);
    }
  },
  copyUint64(bufAddress, value) {
    const buf = createView(8);    
    buf.setBigUint64(0, BigInt(value), this.littleEndian);
    this.moveExternBytes(buf, bufAddress, true);
  },
  copyUint32(bufAddress, value) {
    const buf = createView(4);    
    buf.setUint32(0, value, this.littleEndian);
    this.moveExternBytes(buf, bufAddress, true);
  },
});

export { copyUsize as default };
