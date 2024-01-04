import { restoreMemory } from './memory.js';
import { decodeBase64, decodeText, encodeBase64, encodeText } from './text.js';
import { throwTypeMismatch } from './error.js';
import { MEMORY, VALUE_NORMALIZER } from './symbol.js';
import { checkDataView, isTypedArray, setDataView } from './data-view.js';

export function getValueOf() {
  const map = new Map();
  return this[VALUE_NORMALIZER](map);
}

export function getDataViewAccessors(structure, handlers = {}) {
  return markAsSpecial({
    get() {
      /* WASM-ONLY */
      restoreMemory.call(this);
      /* WASM-ONLY-END */
      return this[MEMORY];
    },
    set(dv) {
      checkDataView(dv);
      setDataView.call(this, dv, structure, true, handlers);
    },
  });
}

export function getBase64Accessors(structure, handlers = {}) {
  return markAsSpecial({
    get() {
      return encodeBase64(this.dataView);
    },
    set(str) {
      if (typeof(str) !== 'string') {
        throwTypeMismatch('string', str);
      }
      const dv = decodeBase64(str);
      setDataView.call(this, dv, structure, false, handlers);
    }
  });
}

export function getStringAccessors(structure, handlers = {}) {
  const { sentinel, instance: { members }} = structure;
  const { byteSize: charSize } = members[0];
  return markAsSpecial({
    get() {
      const dv = this.dataView;
      const TypedArray = (charSize === 1) ? Int8Array : Int16Array;
      const ta = new TypedArray(dv.buffer, dv.byteOffset, this.length);
      const s = decodeText(ta, `utf-${charSize * 8}`);
      debugger;
      return (sentinel?.value === undefined) ? s : s.slice(0, -1);
    },
    set(str) {
      if (typeof(str) !== 'string') {
        throwTypeMismatch('a string', str);
      }
      if (sentinel?.value !== undefined) {
        if (str.charCodeAt(str.length - 1) !== sentinel.value) {
          str = str + String.fromCharCode(sentinel.value);
        }
      }
      const ta = encodeText(str, `utf-${charSize * 8}`);
      const dv = new DataView(ta.buffer);   
      setDataView.call(this, dv, structure, false, handlers);
    },
  });
}

export function getTypedArrayAccessors(structure, handlers = {}) {
  const { typedArray } = structure;
  return markAsSpecial({
    get() {
      const dv = this.dataView;
      const length = dv.byteLength / typedArray.BYTES_PER_ELEMENT;
      return new typedArray(dv.buffer, dv.byteOffset, length);
    },
    set(ta) {
      if (!isTypedArray(ta, typedArray)) {
        throwTypeMismatch(typedArray.name, ta);
      }
      const dv = new DataView(ta.buffer, ta.byteOffset, ta.byteLength);
      setDataView.call(this, dv, structure, true, handlers);
    },
  });
}

function markAsSpecial({ get, set }) {
  get.special = set.special = true;
  return { get, set };
}