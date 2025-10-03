import { memberNames, MemberType } from '../constants.js';
import { mixin } from '../environment.js';
import { FALLBACK } from '../symbols.js';
import { defineProperty, defineValue } from '../utils.js';

// handle retrieval of accessors

export default mixin({
  init() {
    this.accessorCache = new Map();
  },
  getAccessor(access, member) {
    const { type, bitSize, bitOffset, byteSize } = member;
    const names = [];
    const unaligned = (byteSize === undefined) && (bitSize & 0x07 || bitOffset & 0x07);
    if (unaligned) {
      names.push('Unaligned');
    }
    let name = memberNames[type];
    if (bitSize > 32 && (type === MemberType.Int || type === MemberType.Uint)) {
      if (bitSize <= 64) {
        name = `Big${name}`;
      } else {
        name = `Jumbo${name}`;
      }
    }
    names.push(name, `${(type === MemberType.Bool && byteSize) ? byteSize << 3 : bitSize}`);
    if (unaligned) {
      names.push(`@${bitOffset}`);
    }
    const accessorName = access + names.join('');
    let accessor = this.accessorCache.get(accessorName);
    if (accessor) {
      return accessor;
    }
    // see if it's a built-in method of DataView
    accessor = DataView.prototype[accessorName];
    if (!accessor) {
      while (names.length > 0) {
        const handlerName = `getAccessor${names.join('')}`;
        if (accessor = this[handlerName]?.(access, member)) {
          break;
        }
        names.pop();
      }
      /* c8 ignore start */
      if (!accessor) {
        throw new Error(`No accessor available: ${accessorName}`);
      }
      /* c8 ignore end */
    }
    if (process.env.TARGET === 'node') {
      if (accessor && this.usingBufferFallback()) {
        const normal = accessor;
        accessor = (access === 'get')
        ? function(offset, littleEndian) {
            this[FALLBACK]?.(false, offset, byteSize);
            return normal.call(this, offset, littleEndian);
          }
        : function(offset, value, littleEndian) {
            normal.call(this, offset, value, littleEndian);
            this[FALLBACK]?.(true, offset, byteSize);
          };
      }
    }
    if (!accessor.name) {
      defineProperty(accessor, 'name', defineValue(accessorName));
    }
    this.accessorCache.set(accessorName, accessor);
    return accessor;
  },
});
