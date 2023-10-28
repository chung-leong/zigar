import { getStructureFactory, getStructureName } from './structure.js';
import { SLOTS, ENVIROMENT } from './symbol.js';

const default_alignment = 16;
const globalSlots = {};
const consolePending = '';
const consoleTimeout = 0;

export class Environment {
  memoryMap = null;

  getAddress(buffer) {}
  obtainView(address, len) {}
  copyBytes(dst, address, len) {}

  allocMemory(len, ptrAlign) {
    const extra = getExtraCount(ptrAlign);
    const buffer = new ArrayBuffer(len + extra);
    const address = this.getAddress(buffer);
    let offset = 0;
    if (extra !== 0) {
      const mask = ~(extra - 1);
      const aligned = (address & mask) + extra;
      offset = aligned - address;
    }
    const dv = new DataView(buffer, offset, len);
    return dv;
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

  createObject(structure, dv) {
    const { constructor } = structure;
    return constructor(dv);
  }

  readSlot(target, slot) {
    const slots = target ? targets[SLOTS] : globalSlots;
    return slots[slot];
  }

  writeSlot(target, slot, value) {
    const slots = target ? targets[SLOTS] : globalSlots;
    slots[slot] = value;
    return true;
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
      const constructor = f(s);
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
Environment.prototype[ENVIROMENT] = true;

function getExtraCount(ptrAlign) {
  const alignment = (1 << ptrAlign);
  return (alignment <= default_alignment) ? 0 : alignment;
}
