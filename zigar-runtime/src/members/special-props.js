import { StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { MEMORY, RESTORE, SENTINEL } from '../symbols.js';
import { decodeBase64, decodeText, encodeBase64, encodeText } from '../utils.js';

export default mixin({
  defineSpecialProperties(structure) {
    const thisEnv = this;
    const dataView = markAsSpecial({
      get() {
        if (process.env.TARGET === 'wasm') {
          this[RESTORE]?.();
        }
        return this[MEMORY];
      },
      set(dv, fixed) {
        checkDataView(dv);
        thisEnv.assignView(this, dv, structure, true, fixed);
      },
    });
    const base64 = markAsSpecial({
      get() {
        return encodeBase64(this.dataView);
      },
      set(str, fixed) {
        if (typeof(str) !== 'string') {
          throw new TypeMismatch('string', str);
        }
        const dv = decodeBase64(str);
        thisEnv.assignView(this, dv, structure, false, fixed);
      }
    });
    const TypedArray = this.getTypedArray(structure); // (from mixin "structures/all")
    const typedArray = TypedArray && markAsSpecial({
      get() {
        const dv = this.dataView;
        const length = dv.byteLength / TypedArray.BYTES_PER_ELEMENT;
        return new TypedArray(dv.buffer, dv.byteOffset, length);
      },
      set(ta, fixed) {
        if (!isTypedArray(ta, TypedArray)) {
          throw new TypeMismatch(TypedArray.name, ta);
        }
        const dv = new DataView(ta.buffer, ta.byteOffset, ta.byteLength);
        thisEnv.assignView(this, dv, structure, true, fixed);
      },
    });
    const {
      flags,
      instance: { members: [ member ] }
    } = structure;
    // check member type so we don't attach string property to multi-dimensional arrays
    const encoding = `utf-${member?.bitSize}`;
    const string = (flags & StructureFlag.IsString) && markAsSpecial({
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
      set(str, fixed) {
        if (typeof(str) !== 'string') {
          throw new TypeMismatch('a string', str);
        }
        const sentinelValue = this.constructor[SENTINEL]?.value;
        if (sentinelValue !== undefined && str.charCodeAt(str.length - 1) !== sentinelValue) {
          str += String.fromCharCode(sentinelValue);
        }
        const ta = encodeText(str, encoding);
        const dv = new DataView(ta.buffer);
        thisEnv.assignView(this, dv, structure, false, fixed);
      },
    });
    return { dataView, base64, typedArray, string };
  },
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
