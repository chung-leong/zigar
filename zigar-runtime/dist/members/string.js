import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { SENTINEL } from '../symbols.js';
import { markAsSpecial, encodeText, decodeText } from '../utils.js';

var string = mixin({
  defineString(structure) {
    const thisEnv = this;
    const { byteSize } = structure.instance.members[0];
    const encoding = `utf-${byteSize * 8}`;
    return markAsSpecial({
      get() {
        let str = decodeText(this.typedArray, encoding);
        const sentinelValue = this.constructor[SENTINEL]?.value;
        if (sentinelValue !== undefined && str.charCodeAt(str.length - 1) === sentinelValue) {
          str = str.slice(0, -1);
        }
        return str;
      },
      set(str, allocator) {
        if (typeof(str) !== 'string') {
          throw new TypeMismatch('string', str);
        }
        const sentinelValue = this.constructor[SENTINEL]?.value;
        if (sentinelValue !== undefined && str.charCodeAt(str.length - 1) !== sentinelValue) {
          str += String.fromCharCode(sentinelValue);
        }
        const ta = encodeText(str, encoding);
        const dv = new DataView(ta.buffer);
        thisEnv.assignView(this, dv, structure, false, allocator);
      },
    });
  },
});

export { string as default };
