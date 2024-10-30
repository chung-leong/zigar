import { ArrayFlag, SliceFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { FALLBACK, MEMORY, RESTORE, SENTINEL } from '../symbols.js';
import { decodeBase64, decodeText, encodeBase64, encodeText } from '../utils.js';

export default mixin({
  defineSpecialProperties(structure) {
    const descriptors = {};
    const thisEnv = this;
    const syncBuffer = (process.env.TARGET === 'node' && this.usingBufferFallback())
    ? function(toExt) {
        thisEnv.syncExternalBuffer(this.buffer, FALLBACK, toExt);
      }
    : undefined;
    descriptors.dataView = markAsSpecial({
      get() {
        if (process.env.TARGET === 'wasm') {
          this[RESTORE]?.();
        }
        const dv = this[MEMORY];
        if (process.env.TARGET === 'node') {
          syncBuffer?.call(dv, false);
        }
        return dv;
      },
      set(dv, allocator) {
        checkDataView(dv);
        thisEnv.assignView(this, dv, structure, true, allocator);
        if (process.env.TARGET === 'node') {
          syncBuffer?.call(dv, true);
        }
      },
    });
    descriptors.base64 = markAsSpecial({
      get() {
        return encodeBase64(this.dataView);
      },
      set(str, allocator) {
        if (typeof(str) !== 'string') {
          throw new TypeMismatch('string', str);
        }
        const dv = decodeBase64(str);
        thisEnv.assignView(this, dv, structure, false, allocator);
      }
    });
    const TypedArray = this.getTypedArray(structure); // (from mixin "structures/all")
    if (TypedArray) {
      descriptors.typedArray = markAsSpecial({
        get() {
          const dv = this.dataView;
          const length = dv.byteLength / TypedArray.BYTES_PER_ELEMENT;
          return new TypedArray(dv.buffer, dv.byteOffset, length);
        },
        set(ta, allocator) {
          if (!isTypedArray(ta, TypedArray)) {
            throw new TypeMismatch(TypedArray.name, ta);
          }
          const dv = new DataView(ta.buffer, ta.byteOffset, ta.byteLength);
          thisEnv.assignView(this, dv, structure, true, allocator);
        },
      });
      const { type, flags } = structure;
      if ((type === StructureType.Array || flags & ArrayFlag.IsString)
       || (type === StructureType.Slice || flags & SliceFlag.IsString)) {
        const { byteSize } = structure.instance.members[0];
        const encoding = `utf-${byteSize * 8}`;
        descriptors.string = markAsSpecial({
          get() {
            const dv = this.dataView;
            const ta = new TypedArray(dv.buffer, dv.byteOffset, this.length);
            let str = decodeText(ta, encoding);
            const sentinelValue = this.constructor[SENTINEL]?.value;
            if (sentinelValue !== undefined && str.charCodeAt(str.length - 1) === sentinelValue) {
              str = str.slice(0, -1);
            }
            return str;
          },
          set(str, allocator) {
            if (typeof(str) !== 'string') {
              throw new TypeMismatch('a string', str);
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
      }
    }
    return descriptors;
  },
  ...(process.env.TARGET === 'node' ? {
    imports: {
      syncExternalBuffer: null,
    },
  } : undefined)
});

function isTypedArray(arg, TypedArray) {
  const tag = arg?.[Symbol.toStringTag];
  return (!!TypedArray && tag === TypedArray.name);
}

function checkDataView(dv) {
  if (dv?.[Symbol.toStringTag] !== 'DataView') {
    throw new TypeMismatch('a DataView', dv);
  }
  return dv;
}

function markAsSpecial({ get, set }) {
  get.special = set.special = true;
  return { get, set };
}
