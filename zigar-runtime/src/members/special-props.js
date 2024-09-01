import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { MEMORY, MEMORY_RESTORER } from '../symbols.js';
import { decodeBase64, decodeText, encodeBase64, encodeText } from '../utils.js';

export default mixin({
  getSpecialPropertyDescriptors(structure, handlers = {}) {
    const thisEnv = this;
    const dataView = markAsSpecial({
      get() {
        if (process.env.TARGET === 'wasm') {
          this[MEMORY_RESTORER]();
        }
        return this[MEMORY];
      },
      set(dv, fixed) {
        checkDataView(dv);
        thisEnv.assignView(this, dv, structure, true, fixed, handlers);
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
        thisEnv.assignView(this, dv, structure, false, fixed, handlers);
      }
    });
    const { TypedArray } = structure;
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
        thisEnv.assignView(this, dv, structure, true, fixed, handlers);
      },
    });
    const { sentinel, instance: { members }} = structure;
    const { byteSize: charSize } = members[0];
    const string = (TypedArray === Uint8Array || TypedArray === Uint16Array) && markAsSpecial({
      get() {
        const dv = this.dataView;
        const TypedArray = (charSize === 1) ? Int8Array : Int16Array;
        const ta = new TypedArray(dv.buffer, dv.byteOffset, this.length);
        let str = decodeText(ta, `utf-${charSize * 8}`);
        if (sentinel?.value !== undefined) {
          if (str.charCodeAt(str.length - 1) === sentinel.value) {
            str = str.slice(0, -1);
          }
        }
        return str;
      },
      set(str, fixed) {
        if (typeof(str) !== 'string') {
          throw new TypeMismatch('a string', str);
        }
        if (sentinel?.value !== undefined) {
          if (str.charCodeAt(str.length - 1) !== sentinel.value) {
            str = str + String.fromCharCode(sentinel.value);
          }
        }
        const ta = encodeText(str, `utf-${charSize * 8}`);
        const dv = new DataView(ta.buffer);
        thisEnv.assignView(this, dv, structure, false, fixed, handlers);
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
