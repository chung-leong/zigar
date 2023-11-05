const MEMORY = Symbol('memory');
const SLOTS = Symbol('slots');
const POINTER_VISITOR = Symbol('pointerVisitor');
const TARGET_ACQUIRER = Symbol('targetAcquirer');
const ENVIRONMENT = Symbol('environment');

const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  EnumerationItem: 5,
  Object: 6,
  Type: 7,
  Comptime: 8,
};

Array(Object.values(MemberType).length);

function acquireTarget() {
  this[TARGET_ACQUIRER]();
}

const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ArgStruct: 3,
  ExternUnion: 4,
  BareUnion: 5,
  TaggedUnion: 6,
  ErrorUnion: 7,
  ErrorSet: 8,
  Enumeration: 9,
  Optional: 10,
  Pointer: 11,
  Slice: 12,
  Vector: 13,
  Opaque: 14,
  Function: 15,
};

const factories = Array(Object.values(StructureType).length);

function getStructureName(s, full = false) {
  let r = s.name;
  if (!full) {
    r = r.replace(/{.*}/, '');
    r = r.replace(/[^. ]*?\./g, '');
  }
  return r;
}

function getStructureFactory(type) {
  const f = factories[type];
  return f;
}

let decoder;

function decodeText(data, encoding = 'utf-8') {
  if (!decoder) {
    decoder = new TextDecoder;
  }
  return decoder.decode(data);
}

const default_alignment = 16;
const globalSlots = {};

let consolePending = [];
let consoleTimeout = 0;

class Environment {
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

  /* RUNTIME-ONLY */
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
  /* RUNTIME-ONLY-END */

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

/* WASM-ONLY */
class WebAssemblyEnvironment extends Environment {
  nextValueIndex = 1;
  valueTable = { 0: null };
  valueIndices = new WeakMap;
  expectedMethods = {
    alloc: { name: 'allocSharedMemory', argType: 'iii', returnType: 'i' },
    free: { name: 'freeSharedMemory', argType: 'iiii', returnType: '' },
    run: { name: 'runThunk', argType: 'ii', returnType: 'v' },
    safe: { name: 'isRuntimeSafetyActive', argType: '', returnType: 'b' },
  };

  constructor() {
    super();
  }

  releaseObjects() {
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

  fromWebAssembly(type, arg) {
    switch (type) {
      case 'v': return valueTable[arg];
      case 's': return valueTable[arg]?.valueOf();
      case 'i': return arg;
      case 'b': return !!arg;
    }
  }

  toWebAssembly(type, arg) {
    switch (type) {
      case 'v': return this.getObjectIndex(arg);
      case 's': return this.getObjectIndex(new String(arg));
      case 'i': return arg;
      case 'b': return arg ? 1 : 0;
    }
  }

  exportFunction(fn, argType = '', returnType = '') {
    if (!fn) {
      return () => {};
    }
    return function (...args) {
      args = args.map((arg, i) => this.fromWebAssembly(argType.charAt(i), arg));
      const retval = fn.apply(this, args);
      return this.toWebAssembly(returnType, retval);
    };
  }

  importFunction(fn, argType = '', returnType = '') {
    return function (...args) {
      args = args.map((arg, i) => this.toWebAssembly(argType.charAt(i), retval));
      const retval = fn.apply(this, args);
      return this.fromWebAssembly(returnType, retval);
    };
  }

  exportFunctions() {
    return {
      _setCallContext: this.exportFunction(this.allocMemory, 'i', '', true),
      _allocMemory: this.exportFunction(this.allocMemory, 'ii', 'v', true),
      _freeMemory: this.exportFunction(this.freeMemory, 'iii', '', true),
      _createString: this.exportFunction(this.createString, 'ii', 'v'),
      _createObject: this.exportFunction(this.createObject, 'vv', 's'),
      _createView: this.exportFunction(this.createView, 'ii', 'v'),
      _castView: this.exportFunction(this.castView, 'vv', 'v'),
      _readSlot: this.exportFunction(this.readSlot, 'vi', 'v'),
      _writeSlot: this.exportFunction(this.writeSlot, 'viv'),
      _beginDefinition: this.exportFunction(this.beginDefinition),
      _insertInteger: this.exportFunction(this.insertProperty, 'vsi'),
      _insertBoolean: this.exportFunction(this.insertProperty, 'vsb'),
      _insertString: this.exportFunction(this.insertProperty, 'vss'),
      _insertObject: this.exportFunction(this.insertProperty, 'vsv'),
      _beginStructure: this.exportFunction(this.beginStructure, 'v', 'v'),
      _attachMember: this.exportFunction(this.attachMember, 'vvb'),
      _attachMethod: this.exportFunction(this.attachMethod, 'vvb'),
      _createTemplate: this.exportFunction(this.attachMethod, 'v'),
      _attachTemplate: this.exportFunction(this.attachTemplate, 'vvb'),
      _finalizeStructure: this.exportFunction(this.finalizeStructure, 'v'),
      _writeToConsole: this.exportFunction(this.writeToConsole, 'v', '', true),
    }
  }

  importFunctions(exports) {
    for (const [ name, fn ] of Object.entries(exports)) {
      const info = this.expected[name];
      if (info) {
        const { name, argType, returnType } = info;
        this[name] = this.importFunction(fn, argType, returnType);
      }
    }
  }

  releaseFunctions() {
    const throwError = function() {
      throw new Error('WebAssembly instance was abandoned');
    };
    for (const { name } of Object.values(this.expectedMethods)) {
      if (this[name]) {
        this[name] = throwError;
      }
    }
  }

  async createInstance(source) {
    const env = this.exportFunctions();
    if (source[Symbol.toStringTag] === 'Response') {
      return WebAssembly.instantiateStreaming(source, { env });
    } else {
      return WebAssembly.instantiate(source, { env });
    }
  }

  async loadWebAssembly(source) {
    const { instance } = await this.createInstance(source);
    this.memory = instance.memory;
    this.importFunctions(instance.exports);
    // create a WeakRef so that we know whether the instance is gc'ed or not
    const weakRef = new WeakRef(instance);
    return {
      abandon: () => {
        this.memory = null;
        this.releaseFunctions();
        this.unlinkVariables();
      },
      released: () => {
        return !weakRef.deref();
      }
    }
  }


  /* RUNTIME-ONLY */
  finalizeStructures(structures) {
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
      super.finalizeStructure(structure);
      // place structure into its assigned slot
      this.slots[structure.slot] = structure;
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
      if (placeholder.memory) {
        const { array, offset, length } = placeholder.memory;
        new DataView(array.buffer, offset, length);
      } else {
        placeholder.structure;
      }
      placeholder.structure;
      // TODO: refactoring
      // const object = constructor.call(ZIG, dv);
      if (placeholder.slots) {
        insertObjects(object[SLOTS], placeholder.slots);
      }
      if (placeholder.address !== undefined) {
        // need to replace dataview with one pointing to WASM memory later,
        // when the VM is up and running
        this.variables.push({ address: placeholder.address, object });
      }
      return object;
    }

    function createThunk(index) {
      return function(argStruct) {
        return this.runThunk(index, argStruct);
      };
    }

    let resolve, reject;
    const promise = new Promise((r1, r2) => {
      resolve = r1;
      reject = r2;
    });
    this.runThunk = function(index, argStruct) {
      // wait for linking to occur, then call function again
      // this.runThunk should have been replaced
      return promise.then(() => this.runThunk(index, argStruct));
    };
    return { resolve, reject };
  }

  async linkWebAssembly(source, params) {
    const zigar = await this.loadWebAssembly(source);
    return zigar;
  }
  /* RUNTIME-ONLY */
}
/* WASM-ONLY-END */

class CallContext {
  pointerProcessed = new Map();
  memoryList = [];
}

function getGlobalSlots() {
  return globalSlots;
}

function getExtraCount(ptrAlign) {
  const alignment = (1 << ptrAlign);
  return (alignment <= default_alignment) ? 0 : alignment;
}

function findSortedIndex(array, address) {
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

export { Environment, WebAssemblyEnvironment, findSortedIndex, getGlobalSlots };
