import { memberNames, MemberType } from '../constants.js';
import { mixin } from '../environment.js';
import { FALLBACK } from '../symbols.js';
import { defineProperty, defineValue, usize } from '../utils.js';

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
    names.push(name, `${(type === MemberType.Bool && byteSize) ? byteSize * 8 : bitSize}`);
    if (unaligned) {
      names.push(`@${bitOffset}`);
    }
    const accessorName = access + names.join('');
    // see if it's a built-in method of DataView
    let accessor = DataView.prototype[accessorName];
    if (process.env.TARGET === 'node') {
      if (accessor && this.usingBufferFallback()) {
        const thisEnv = this;
        const normal = accessor;
        const getAddress = function(offset) {
          const { buffer, byteOffset, byteLength } = this;
          const base = buffer[FALLBACK];
          if (base) {
            if (offset < 0 || (offset + bitSize / 8) > byteLength) {
              throw new RangeError('Offset is outside the bounds of the DataView');
            }
            return base + usize(byteOffset + offset);
          }
        };
        accessor = (access === 'get')
        ? function(offset, littleEndian) {
            const address = getAddress.call(this, offset);
            if (address !== undefined) {
              return thisEnv.getNumericValue(type, bitSize, address);
            } else {
              return normal.call(this, offset, littleEndian);
            }
          }
        : function(offset, value, littleEndian) {
            const address = getAddress.call(this, offset);
            if (address !== undefined) {
              return thisEnv.setNumericValue(type, bitSize, address, value);
            } else {
              return normal.call(this, offset, value, littleEndian);
            }
          };
      }
    }
    if (accessor) {
      return accessor;
    }
    // check cache
    accessor = this.accessorCache.get(accessorName);
    if (accessor) {
      return accessor;
    }
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
    defineProperty(accessor, 'name', defineValue(accessorName));
    this.accessorCache.set(accessorName, accessor);
    return accessor;
  },
  ...(process.env.TARGET === 'node' ? {
    imports: {
      getNumericValue: null,
      setNumericValue: null,
    },
  } : undefined),
});
