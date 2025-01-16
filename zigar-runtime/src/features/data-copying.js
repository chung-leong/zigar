import { MemberType } from '../constants.js';
import { mixin } from '../environment.js';
import { MEMORY, RESTORE, ZIG } from '../symbols.js';
import { empty } from '../utils.js';

export default mixin({
  copiers: null,
  resetters: null,

  defineCopier(size, multiple) {
    const copy = this.getCopyFunction(size, multiple);
    return {
      value(target) {
        if (process.env.TARGET === 'wasm') {
          this[RESTORE]?.();
          target[RESTORE]?.();
        }
        const src = target[MEMORY];
        const dest = this[MEMORY];
        copy(dest, src);
      },
    };
  },
  defineResetter(offset, size) {
    const reset = this.getResetFunction(size);
    return {
      value() {
        if (process.env.TARGET === 'wasm') {
          this[RESTORE]?.();
        }
        const dest = this[MEMORY];
        reset(dest, offset, size);
      }
    };
  },
  getCopyFunction(size, multiple = false) {
    if (!this.copiers) {
      this.copiers = this.defineCopiers();
    }
    const f = !multiple ? this.copiers[size] : undefined;
    return f ?? this.copiers.any;
  },
  getResetFunction(size) {
    if (!this.resetters) {
      this.resetters = this.defineResetters();
    }
    return this.resetters[size] ?? this.resetters.any;
  },
  defineCopiers() {
    const int8 = { type: MemberType.Int, bitSize: 8, byteSize: 1 };
    const int16 = { type: MemberType.Int, bitSize: 16, byteSize: 2 };
    const int32 = { type: MemberType.Int, bitSize: 32, byteSize: 4 };
    const getInt8 = this.getAccessor('get', int8);
    const setInt8 = this.getAccessor('set', int8);
    const getInt16 = this.getAccessor('get', int16);
    const setInt16 = this.getAccessor('set', int16);
    const getInt32 = this.getAccessor('get', int32);
    const setInt32 = this.getAccessor('set', int32);

    return {
      0: empty,
      1: function(dest, src) {
        setInt8.call(dest, 0, getInt8.call(src, 0));
      },
      2: function(dest, src) {
        setInt16.call(dest, 0, getInt16.call(src, 0, true), true);

      },
      4: function(dest, src) {
        setInt32.call(dest, 0, getInt32.call(src, 0, true), true);
      },
      8: function(dest, src) {
        setInt32.call(dest, 0, getInt32.call(src, 0, true), true);
        setInt32.call(dest, 4, getInt32.call(src, 4, true), true);
      },
      16: function(dest, src) {
        setInt32.call(dest, 0, getInt32.call(src, 0, true), true);
        setInt32.call(dest, 4, getInt32.call(src, 4, true), true);
        setInt32.call(dest, 8, getInt32.call(src, 8, true), true);
        setInt32.call(dest, 12, getInt32.call(src, 12, true), true);
      },
      'any': function(dest, src) {
        let i = 0, len = dest.byteLength;
        while (i + 4 <= len) {
          setInt32.call(dest, i, getInt32.call(src, i, true), true);
          i += 4;
        }
        while (i + 1 <= len) {
          setInt8.call(dest, i, getInt8.call(src, i));
          i++;
        }
      },
    }
  },
  defineResetters() {
    const int8 = { type: MemberType.Int, bitSize: 8, byteSize: 1 };
    const int16 = { type: MemberType.Int, bitSize: 16, byteSize: 2 };
    const int32 = { type: MemberType.Int, bitSize: 32, byteSize: 4 };
    const setInt8 = this.getAccessor('set', int8);
    const setInt16 = this.getAccessor('set', int16);
    const setInt32 = this.getAccessor('set', int32);
    return {
      0: empty,
      1: function(dest, offset) {
        setInt8.call(dest, offset, 0);
      },
      2: function(dest, offset) {
        setInt16.call(dest, offset, 0, true);

      },
      4: function(dest, offset) {
        setInt32.call(dest, offset, 0, true);
      },
      8: function(dest, offset) {
        setInt32.call(dest, offset + 0, 0, true);
        setInt32.call(dest, offset + 4, 0, true);
      },
      16: function(dest, offset) {
        setInt32.call(dest, offset + 0, 0, true);
        setInt32.call(dest, offset + 4, 0, true);
        setInt32.call(dest, offset + 8, 0, true);
        setInt32.call(dest, offset + 12, 0, true);
      },
      any: function(dest, offset, len) {
        let i = offset;
        while (i + 4 <= len) {
          setInt32.call(dest, i, 0, true);
          i += 4;
        }
        while (i + 1 <= len) {
          setInt8.call(dest, i, 0);
          i++;
        }
      },
    };
  },
  ...(process.env.TARGET === 'wasm' ? {
    defineRetvalCopier({ byteSize, bitOffset }) {
      if (byteSize > 0) {
        const thisEnv = this;
        const offset = bitOffset >> 3;
        const copy = this.getCopyFunction(byteSize);
        return {
          value(shadowDV) {
            const dv = this[MEMORY];
            const { address } = shadowDV[ZIG];
            const src = new DataView(thisEnv.memory.buffer, address + offset, byteSize);
            const dest = new DataView(dv.buffer, dv.byteOffset + offset, byteSize);
            copy(dest, src);
          }
        };
      }
    },
    copyExternBytes(dst, address, len) {
      const { memory } = this;
      const src = new DataView(memory.buffer, address, len);
      const copy = this.getCopyFunction(len);
      copy(dst, src);
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      copyExternBytes: null,
    },
  } : undefined)
});
