import { getStructureFactory, getStructureName } from './structure.js';
import { decodeText } from './text.js';
import { acquireTarget } from './pointer.js';
import { initializeErrorSets } from './error-set.js';
import { throwZigError } from './error.js';
import { MEMORY, SLOTS, ENVIRONMENT, POINTER_VISITOR, CHILD_VIVIFICATOR, RELEASE_THUNK } from './symbol.js';

const default_alignment = 16;
const globalSlots = {};

let consolePending = [];
let consoleTimeout = 0;

export class Environment {
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
  findSentinel(address, bytes: DataView): number {
    // return offset where sentinel value is found
  }
  */
  context;
  contextStack = [];

  startContext() {
    if (this.context) {
      this.contextStack.push(this.context);
    }
    this.context = new CallContext();
  }

  endContext() {
    this.context = this.contextStack.pop();
  }

  rememberPointer(pointer) {
    const { pointerProcessed } = this.context;
    if (pointerProcessed.get(pointer)) {
      return true;
    } else {
      pointerProcessed.set(pointer, true);
      this.importMemory(pointer[MEMORY]);
      return false;
    }
  }

  importMemory(dv) {
    const { memoryList } = this.context;
    const { buffer } = dv;
    const address = this.getAddress(buffer);
    const offset = (typeof(address) === 'bigint') ? BigInt(dv.byteOffset) : dv.byteOffset;
    const index = findSortedIndex(memoryList, address);
    memoryList.splice(index, 0, { address, buffer, len: buffer.byteLength });
    return address + offset;
  }

  findMemory(address, len) {
    if (this.context) {
      const { memoryList } = this.context;
      const index = findSortedIndex(memoryList, address);
      const at = memoryList[index];
      let memory;
      if (at?.address == address) {
        memory = at;
      } else if (index > 0) {
        const prev = memoryList[index - 1];
        if (prev?.address > address && address < prev.address + prev.len) {
          memory = prev;
        }
      }
      if (memory) {
        const offset = Number(address - memory.address);
        return new DataView(memory.buffer, offset, len);
      }
    }
    // not found in any of the buffers we've seen--assume it's shared memory
    return this.obtainView(address, len);
  }

  getViewAddress(dv) {
    const address = this.getAddress(dv.buffer);
    const offset = (typeof(address) === 'bigint') ? BigInt(dv.byteOffset) : dv.byteOffset;
    return address + offset;
  }

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
    if (this.context) {
      this.importMemory(dv);
    }
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
    const { constructor, hasPointer } = structure;
    const object = constructor.call(ENVIRONMENT, dv);
    if (hasPointer) {
      // vivificate pointers and acquire their targets
      object[POINTER_VISITOR](acquireTarget, { vivificate: true });
    }
    return object;
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

  writeToConsole(dv) {
    try {
      const array = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      // send text up to the last newline character
      const index = array.lastIndexOf('\n');
      if (index === -1) {
        consolePending.push(array);
      } else {
        const beginning = array.subarray(0, index + 1);
        const remaining = array.slice(index + 1);   // copying, in case incoming buffer is pointing to stack memory
        const list = [ ...consolePending, beginning ];
        console.log(decodeText(list));
        consolePending = (remaining.length > 0) ? [ remaining ] : [];
      }
      clearTimeout(consoleTimeout);
      if (consolePending) {
        consoleTimeout = setTimeout(() => {
          console.log(decodeText(consolePending));
          consolePending = [];
        }, 250);
      }
      /* c8 ignore next 3 */
    } catch (err) {
      console.error(err);
    }
  }

  flushConsole() {
    if (consolePending.length > 0) {
      console.log(decodeText(consolePending));
      consolePending = [];
      clearTimeout(consoleTimeout);
    }
  }
}

export class NodeEnvironment extends Environment {
  // C++ code will patch in getAddress, obtainView, copyBytes, and findSentinel

  invokeFactory(thunk) {
    initializeErrorSets();
    const result = thunk.call(this);
    if (typeof(result) === 'string') {
      // an error message
      throwZigError(result);
    }
    let module = result.constructor;
    // attach __zigar object
    const initPromise = Promise.resolve();
    module.__zigar = {
      init: () => initPromise,
      abandon: () => initPromise.then(() => {
        if (module) {
          this.releaseModule(module);
        }
        module = null;
      }),
      released: () => initPromise.then(() => !module),
    };
    return module;
  }

  releaseModule(module) {
    const released = new Map();
    const replacement = function() {
      throw new Error(`Shared library was abandoned`);
    };
    const releaseClass = (cls) => {
      if (!cls || released.get(cls)) {
        return;
      }
      released.set(cls, true);
      // release static variables--vivificators return pointers
      const vivificators = cls[CHILD_VIVIFICATOR];
      if (vivificators) {
        for (const vivificator of Object.values(vivificators)) {
          const ptr = vivificator.call(cls);
          if (ptr) {
            releaseObject(ptr);
          }
        }
      }
      for (const [ name, { value, get, set }  ] of Object.entries(Object.getOwnPropertyDescriptors(cls))) {
        if (typeof(value) === 'function') {
          // release thunk of static function
          value[RELEASE_THUNK]?.(replacement);
        } else if (get && !set) {
          // the getter might return a type/class/constuctor
          const child = cls[name];
          if (typeof(child) === 'function') {
            releaseClass(child);
          }
        }
      }
      for (const [ name, { value } ] of Object.entries(Object.getOwnPropertyDescriptors(cls.prototype))) {
        if (typeof(value) === 'function') {
          // release thunk of instance function
          value[RELEASE_THUNK]?.(replacement);
        }
      }
    };
    const releaseObject = (obj) => {
      if (!obj || released.get(obj)) {
        return;
      }
      released.set(obj, true);
      const dv = obj[MEMORY];
      if (dv.buffer instanceof SharedArrayBuffer) {
        // create new buffer and copy content from shared memory
        const ta = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
        const ta2 = new Uint8Array(ta);
        const dv2 = new DataView(ta2.buffer);
        obj[MEMORY] = dv2;
      }
      const slots = obj[SLOTS];
      if (slots) {
        // TODO: refactoring
        // for (const child of Object.values(slots)) {
        //   // deal with pointers in structs
        //   if (child.hasOwnProperty(ZIG)) {
        //     releaseObject(child);
        //   }
        // }
        // if (obj.hasOwnProperty(ZIG)) {
        //   // a pointer--release what it's pointing to
        //   releaseObject(obj[SLOTS][0]);
        // } else {
        //   // force recreation of child objects so they'll use non-shared memory
        //   obj[SLOTS] = {};
        // }
      }
    };
    releaseClass(module);
  }
}

export class WebAssemblyEnvironment extends Environment {
  nextValueIndex = 0;
  valueTable = null;
  valueIndices = null;

  constructor() {
    this.resetValueTables();
  }

  resetValueTables() {
    if (this.nextValueIndex !== 1) {
      this.nextValueIndex = 1;
      this.valueTable = { 0: null };
      this.valueIndices = new WeakMap();
    }
  }

  getObjectIndex(object) {
    if (object != undefined) {
      let index = this.valueIndices.get(object);
      if (index === undefined) {
        index = nextValueIndex++;
        this.valueIndices.set(object, index);
        this.valueTable[index] = object;
      }
      return index;
    } else {
      return 0;
    }
  }

  createBridge(fn, argType = '', returnType = '', runtime = false) {
    if (process.env.ZIGAR_TARGET === 'WASM-COMPTIME' && !runtime) {
      return () => {};
    }
    return function (...args) {
      args = args.map((arg, i) => {
        switch (argType.charAt(i)) {
          case 'v': return valueTable[arg];
          case 's': return valueTable[arg]?.valueOf();
          case 'i': return arg;
          case 'b': return !!arg;
        }
      });
      const retval = fn.apply(env, args);
      switch (returnType) {
        case 'v': return this.getObjectIndex(retval);
        case 's': return this.getObjectIndex(new String(retval));
        case 'i': return retval;
        case 'b': return arg ? 1 : 0;
    }
    };
  }

  createImports() {
    return {
      _allocMemory: this.createBridge(this.allocMemory, 'ii', 'v', true),
      _freeMemory: this.createBridge(this.freeMemory, 'iii', '', true),
      _createString: this.createBridge(this.createString, 'ii', 'v'),
      _createObject: this.createBridge(this.createObject, 'vv', 's'),
      _createView: this.createBridge(this.createView, 'ii', 'v'),
      _castView: this.createBridge(this.castView, 'vv', 'v'),
      _readSlot: this.createBridge(this.readSlot, 'vi', 'v'),
      _writeSlot: this.createBridge(this.writeSlot, 'viv'),
      _beginDefinition: this.createBridge(this.beginDefinition),
      _insertInteger: this.createBridge(this.insertProperty, 'vsi'),
      _insertBoolean: this.createBridge(this.insertProperty, 'vsb'),
      _insertString: this.createBridge(this.insertProperty, 'vss'),
      _beginStructure: this.createBridge(this.beginStructure, 'v', 'v'),
      _attachMember: this.createBridge(this.attachMember, 'vvb'),
      _attachMethod: this.createBridge(this.attachMethod, 'vvb'),
      _attachTemplate: this.createBridge(this.attachTemplate, 'vvb'),
      _finalizeStructure: this.createBridge(this.finalizeStructure, 'v'),
      _writeToConsole: this.createBridge(this.writeToConsole, 'v', '', true),
    }
  }

  beginDefinition() {
    return {};
  }

  insertProperty(def, name, value) {
    def[name] = value;
  }

  finalizeStructures(structures) {
    const slots = {};
    const variables = [];
    initializeErrorSets();
    for (const structure of structures) {
      for (const target of [ structure.static, structure.instance ]) {
        // first create the actual template using the provided placeholder
        if (target.template) {
          target.template = createTemplate(target.template);
        }
      }
      for (const method of structure.static.methods) {
        // create thunk function
        method.thunk = createThunk(method.thunk);
      }
      this.finalizeStructure(structure);
      // place structure into its assigned slot
      slots[structure.slot] = structure;
    }

    function createTemplate(placeholder) {
      const template = {};
      if (placeholder.memory) {
        const { array, offset, length } = placeholder.memory;
        template[MEMORY] = new DataView(array.buffer, offset, length);
      }
      if (placeholder.slots) {
        template[SLOTS] = insertObjects({}, placeholder.slots);
      }
      return template;
    }

    function insertObjects(dest, placeholders) {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = createObject(placeholder);
      }
      return dest;
    }

    function createObject(placeholder) {
      let dv;
      if (placeholder.memory) {
        const { array, offset, length } = placeholder.memory;
        dv = new DataView(array.buffer, offset, length);
      } else {
        const { byteSize } = placeholder.structure;
        dv = new DataView(new ArrayBuffer(byteSize));
      }
      const { constructor } = placeholder.structure;
      // TODO: refactoring
      // const object = constructor.call(ZIG, dv);
      if (placeholder.slots) {
        insertObjects(object[SLOTS], placeholder.slots);
      }
      if (placeholder.address !== undefined) {
        // need to replace dataview with one pointing to WASM memory later,
        // when the VM is up and running
        variables.push({ address: placeholder.address, object });
      }
      return object;
    }

    let resolve, reject;
    const promise = new Promise((r1, r2) => {
      resolve = r1;
      reject = r2;
    });
    const methodRunner = {
      0: function(index, argStruct) {
        // wait for linking to occur, then activate the runner again
        return promise.then(() => methodRunner[0].call(this, index, argStruct));
      },
    };

    function createThunk(index) {
      return function(argStruct) {
        return methodRunner[0](index, argStruct);
      };
    }

    return { promise, resolve, reject, slots, variables, methodRunner };
  }
}

class CallContext {
  pointerProcessed = new Map();
  memoryList = [];
}

export function getGlobalSlots() {
  return globalSlots;
}

function getExtraCount(ptrAlign) {
  const alignment = (1 << ptrAlign);
  return (alignment <= default_alignment) ? 0 : alignment;
}

export function findSortedIndex(array, address) {
  let low = 0;
  let high = array.length;
  if (high === 0) {
    return 0;
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const address2 = array[mid].address;
    if (address2 < address) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return high;
}

function isMisaligned({ address }, ptrAlign) {
  const mask = (1 << ptrAlign) - 1;
  return (address & mask) !== 0;
}
