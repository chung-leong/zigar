import { getStructureFactory, getStructureName } from './structure.js';
import { decodeText } from './text.js';
import { MEMORY, SLOTS, ENVIRONMENT } from './symbol.js';

const default_alignment = 16;
const globalSlots = {};

let consolePending = '';
let consoleTimeout = 0;

export class BaseEnvironment {
  memoryPool = null;

  /*
  Functions to be defined in subclass:

  getAddress(buffer: ArrayBuffer): bigInt|number {
    // return a buffer's address
  }
  obtainView(address: bigInt|number, len: number): DataView {
    // obtain a data view of memory at given address
  }
  copyBytes(dst: DataView, address: bigInt|number, len: number): void {
    // copy memory at given address into destination view
  }

  */

  allocMemory(len, ptrAlign) {
    const extra = getExtraCount(ptrAlign);
    const buffer = new ArrayBuffer(len + extra);
    let offset = 0;
    if (extra !== 0) {
      const address = this.getAddress(buffer);
      const mask = ~(extra - 1);
      const aligned = (address & mask) + extra;
      offset = aligned - address;
    }
    const dv = new DataView(buffer, offset, len);
    return dv;
  }

  freeMemory(address, len, ptrAlign) {
  }

  isShared(dv) {
    return dv.buffer instanceof SharedArrayBuffer;
  }

  createView(address, len, ptrAlign, copy) {
    if (copy) {
      const dv = this.allocMemory(len, ptrAlign);
      this.copyBytes(dv, address, len);
      return dv;
    } else {
      return this.obtainView(address, len);
    }
  }

  castView(structure, dv) {
    const { constructor } = structure;
    return constructor.call(ENVIRONMENT, dv);
  }

  createObject(structure, arg) {
    const { constructor } = structure;
    return new constructor(arg);
  }

  readSlot(target, slot) {
    const slots = target ? target[SLOTS] : globalSlots;
    return slots?.[slot];
  }

  writeSlot(target, slot, value) {
    const slots = target ? target[SLOTS] : globalSlots;
    if (slots) {
      slots[slot] = value;
    }
  }

  createTemplate(dv) {
    return {
      [MEMORY]: dv,
      [SLOTS]: {}
    };
  }

  beginStructure(def, options = {}) {
    const {
      type,
      name,
      length,
      byteSize,
      align,
      isConst,
      hasPointer,
    } = def;
    return {
      constructor: null,
      typedArray: null,
      type,
      name,
      length,
      byteSize,
      align,
      isConst,
      hasPointer,
      instance: {
        members: [],
        methods: [],
        template: null,
      },
      static: {
        members: [],
        methods: [],
        template: null,
      },
      options,
    };
  }

  attachMember(s, member, isStatic = false) {
    const target = (isStatic) ? s.static : s.instance;
    target.members.push(member);
  }

  attachMethod(s, method, isStaticOnly = false) {
    s.static.methods.push(method);
    if (!isStaticOnly) {
      s.instance.methods.push(method);
    }
  }

  attachTemplate(s, template, isStatic = false) {
    const target = (isStatic) ? s.static : s.instance;
    target.template = template;
  }

  finalizeStructure(s) {
    try {
      const f = getStructureFactory(s.type);
      const constructor = f(s, this);
      if (typeof(constructor) === 'function') {
        Object.defineProperties(constructor, {
          name: { value: getStructureName(s), writable: false }
        });
        if (!constructor.prototype.hasOwnProperty(Symbol.toStringTag)) {
          Object.defineProperties(constructor.prototype, {
            [Symbol.toStringTag]: { value: s.name, configurable: true, writable: false }
          });
        }
      }
      return constructor;
      /* c8 ignore next 4 */
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  writeToConsole(buffer) {
    try {
      const s = decodeText(buffer);
      // send text up to the last newline character
      const index = s.lastIndexOf('\n');
      if (index === -1) {
        consolePending += s;
      } else {
        console.log(consolePending + s.substring(0, index));
        consolePending = s.substring(index + 1);
      }
      clearTimeout(consoleTimeout);
      if (consolePending) {
        consoleTimeout = setTimeout(() => {
          console.log(consolePending);
          consolePending = '';
        }, 250);
      }
      /* c8 ignore next 3 */
    } catch (err) {
      console.error(err);
    }
  }

  flushConsole() {
    if (consolePending) {
      console.log(consolePending);
      consolePending = '';
      clearTimeout(consoleTimeout);
    }
  }
}

export function getGlobalSlots() {
  return globalSlots;
}

function getExtraCount(ptrAlign) {
  const alignment = (1 << ptrAlign);
  return (alignment <= default_alignment) ? 0 : alignment;
}
