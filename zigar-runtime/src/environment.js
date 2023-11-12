import { defineProperties, getStructureFactory, getStructureName } from './structure.js';
import { decodeText } from './text.js';
import { acquireTarget, updateAddress } from './pointer.js';
import { initializeErrorSets } from './error-set.js';
import { throwZigError } from './error.js';
import { ADDRESS_UPDATER, ALIGN, CHILD_VIVIFICATOR, ENVIRONMENT, MEMORY, MEMORY_COPIER, POINTER_SELF, POINTER_VISITOR, SLOTS,
  THUNK_REPLACER } from './symbol.js';
import { getMemoryCopier } from './memory.js';

const defAlign = 16;

export class Environment {
  context;
  contextStack = [];
  consolePending = [];
  consoleTimeout = 0;
  slots = {}

  /*
  Functions to be defined in subclass:

  getBufferAddress(buffer: ArrayBuffer): bigInt|number {
    // return a buffer's address
  }
  allocateRelocatableMemory(len: number, align: number): DataView {
    // allocate memory and remember its address
  }
  allocateShadowMemory(len: number, align: number): DataView {
    // allocate memory for shadowing objects
  }
  freeRelocatableMemory(address: bigInt|number, len: number, align: number): void {
    // free previously allocated memory
  }
  freeShadowMemory(address: bigInt|number, len: number, align: number): void {
    // free memory allocated for shadow
  }
  createFixedBuffer(len: number, align: number): DataView {
    // allocate fixed memory and remember its address
  }
  obtainFixedView(address: bigInt|number, len: number): DataView {
    // obtain a data view of memory at given address
  }
  copyBytes(dst: DataView, address: bigInt|number, len: number): void {
    // copy memory at given address into destination view
  }
  findSentinel(address, bytes: DataView): number {
    // return offset where sentinel value is found
  }
  isFixed(dv: DataView): boolean {
    // return true/false depending on whether view is point to shared memory
  }
  */

  startContext() {
    if (this.context) {
      this.contextStack.push(this.context);
    }
    this.context = new CallContext();
  }

  endContext() {
    this.context = this.contextStack.pop();
  }

  getAlignmentExtra(align) {
    return 0;
  }

  createBuffer(len, align, fixed = false) {
    if (fixed) {
      return this.createFixedBuffer(len, align);
    } else {
      return this.createRelocatableBuffer(len, align);
    }
  }

  createRelocatableBuffer(len, align) {
    const extra = this.getAlignmentExtra(align);
    const buffer = new ArrayBuffer(len + extra);
    let offset = 0;
    if (extra !== 0) {
      const address = this.getBufferAddress(buffer);
      const align = getAlignedAddress(address, align);
      offset = aligned - address;
    }
    return new DataView(buffer, offset, len);
  }

  registerMemory(dv) {
    const { memoryList } = this.context;
    const { buffer } = dv;
    const address = this.getViewAddress(buffer);
    const index = findMemoryIndex(memoryList, address);
    memoryList.splice(index, 0, { address, buffer, len: buffer.byteLength });
    return addLength(address, dv.byteOffset);
  }

  unregisterMemory(address) {
    const index = findMemoryIndex(memoryList, address);
    const prev = memoryList[index - 1];
    if (prev?.address === address) {
      memoryList.splice(index, 1);
    }
  }

  findMemory(address, len) {
    if (this.context) {
      const { memoryList } = this.context;
      const index = findMemoryIndex(memoryList, address);
      const prev = memoryList[index - 1];
      if (prev?.address <= address && address < addLength(prev.address, prev.len)) {
        const offset = Number(address - prev.address);
        return new DataView(prev.buffer, offset, len);
      }
    }
    // not found in any of the buffers we've seen--assume it's shared memory
    return this.obtainView(address, len);
  }

  getViewAddress(dv) {
    const address = this.getBufferAddress(dv.buffer);
    return addLength(address, dv.byteOffset);
  }

  createView(address, len, ptrAlign, copy) {
    if (copy) {
      const dv = this.createRelocatableBuffer(len, ptrAlign);
      this.copyBytes(dv, address, len);
      return dv;
    } else {
      return this.obtainFixedView(address, len);
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

  addShadow(shadow, object) {
    let { shadowMap } = this.context;
    if (!shadowMap) {
      shadowMap = this.context.shadowMap = new Map();
    }
    shadowMap.set(shadow, object);
  }

  createShadow(object) {
    const dv = object[MEMORY]
    const align = object.constructor[ALIGN];
    const shadowDV = this.allocShadowMemory(dv.byteLength, align);
    const shadow = { [MEMORY]: shadowDV };
    object[MEMORY_COPIER].call(shadow, object);
    this.addShadow(shadow, object);
    return shadow;
  }

  createShadowForRange(sourceBuffer, startOffset, endOffset, aligns) {
    let maxAlign = 0, maxAlignOffset;
    for (const [ offset, align ] of Object.entries(aligns)) {
      if (align > maxAlign) {
        maxAlign = align;
        maxAlignOffset = offset;
      }
    }
    const len = endOffset - startOffset;
    // make sure the shadow buffer is large enough
    const { buffer } = this.allocShadowMemory(len + maxAlign, 0);
    const address = this.getBufferAddress(buffer);
    const maxAlignMask = ~(maxAlign - 1);
    const maxAlignAddress = (add(address + maxAlignOffset) & maxAlignMask) + maxAlign;
    const shadowAddress = maxAlignAddress

    const shadow = {
      constructor: { [ALIGN]: maxAlign },
      [MEMORY]: shadowDV,

    };


  }

  releaseShadows() {
    for (const [ shadow, object ] of this.context.shadowMap) {
      object[MEMORY_COPIER](shadow);
      const shadowDV = shadow[MEMORY];
      const address = this.getViewAddress(shadowDV);
      const len = shadowDV.byteLength;
      const align = object.constructor[ALIGN];
      this.freeShadowMemory(address, len, align);
    }
  }

  readSlot(target, slot) {
    const slots = target ? target[SLOTS] : this.slots;
    return slots?.[slot];
  }

  writeSlot(target, slot, value) {
    const slots = target ? target[SLOTS] : this.slots;
    if (slots) {
      slots[slot] = value;
    }
  }

  /* COMPTIME-ONLY */
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
  /* COMPTIME-ONLY-END */

  /* RUNTIME-ONLY */
  finalizeStructure(s) {
    try {
      const f = getStructureFactory(s.type);
      const constructor = f(s, this);
      if (typeof(constructor) === 'function') {
        defineProperties(constructor, {
          name: { value: getStructureName(s), writable: false }
        });
        if (!constructor.prototype.hasOwnProperty(Symbol.toStringTag)) {
          defineProperties(constructor.prototype, {
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

  createCaller(method, useThis) {
    let { name,  argStruct, thunk } = method;
    const { constructor } = argStruct;
    const self = this;
    let f;
    if (useThis) {
      f = function(...args) {
        return self.invokeThunk(thunk, new constructor([ this, ...args ]));
      }
    } else {
      f = function(...args) {
        return self.invokeThunk(thunk, new constructor(args));
      }
    }
    Object.defineProperty(f, 'name', { value: name });
    /* NODE-ONLY */
    // need to set the local variables as well as the property of the method object
    /* c8 ignore next */
    f[THUNK_REPLACER] = r => thunk = argStruct = method.thunk = r;
    /* NODE-ONLY-END */
    return f;
  }
  /* RUNTIME-ONLY-END */

  writeToConsole(dv) {
    try {
      const array = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      // send text up to the last newline character
      const index = array.lastIndexOf(0x0a);
      if (index === -1) {
        this.consolePending.push(array);
      } else {
        const beginning = array.subarray(0, index);
        const remaining = array.slice(index + 1);   // copying, in case incoming buffer is pointing to stack memory
        const list = [ ...this.consolePending, beginning ];
        console.log(decodeText(list));
        this.consolePending = (remaining.length > 0) ? [ remaining ] : [];
      }
      clearTimeout(this.consoleTimeout);
      if (this.consolePending.length > 0) {
        this.consoleTimeout = setTimeout(() => {
          console.log(decodeText(this.consolePending));
          this.consolePending = [];
        }, 250);
      }
      /* c8 ignore next 3 */
    } catch (err) {
      console.error(err);
    }
  }

  flushConsole() {
    if (this.consolePending.length > 0) {
      console.log(decodeText(this.consolePending));
      this.consolePending = [];
      clearTimeout(this.consoleTimeout);
    }
  }

  collectPointers(args) {
    const pointerMap = new Map();
    const bufferMap = new Map();
    let buffersWithOverlaps = null;
    const callback = function({ validate }) {
      if (!validate(this)) {
        return;
      }
      // bypass proxy
      const pointer = this[POINTER_SELF];
      if (pointerMap.get(pointer)) {
        return;
      }
      const target = pointer['*'];
      if (target) {
        const dv = target[MEMORY];
        const info = {
          const: pointer.constructor.const,
          target,
        };
        pointerMap.set(pointer, info);
        // see if the buffer is shared with other objects
        const other = bufferMap.get(dv.buffer);
        if (other) {
          const { byteOffset } = dv;
          const array = Array.isArray(other) ? other : [ other ];
          const index = findSortedIndex(array, byteOffset, i => i.target[MEMORY].byteOffset);
          const prev = array[index - 1];
          if (prev) {
            // see if the views overlap
            const prevEnd = prev.target[MEMORY].byteOffset + prev.target[MEMORY].byteLength;
            if (prevEnd > byteOffset) {
              if (!buffersWithOverlaps) {
                buffersWithOverlaps = [ dv.buffer ];
              } else if (!buffersWithOverlaps.includes(dv.buffer)) {
                buffersWithOverlaps.push(dv.buffer);
              }
            }
          }
          array.splice(index, 0, info);
          if (!Array.isArray(other)) {
            bufferMap.set(dv.buffer, other);
          }
        }
        target[POINTER_VISITOR]?.(callback);
      }
    };
    args[POINTER_VISITOR](callback, {});
    if (buffersWithOverlaps) {
      for (const buffer of buffersWithOverlaps) {
        // overlapping views needs be shadowed together
        // attach an object into each of the pointers so we can allocate a single
        // block with for all of them
        const array = bufferMap.get(buffer);
        const jointSource = {
          aligns: {},
          startOffset: 0,
          endOffset: 0,
          address: undefined,
        };
        for (const [ index, info ] of array.entries()) {
          const { byteOffset, byteLength } = info.dataView;
          jointSource.aligns[byteOffset] = info.target.constructor[ALIGN];
          if (index === 0) {
            jointSource.startOffset = byteOffset;
          }
          if (index === array.length - 1) {
            jointSource.endOffset = byteOffset + byteLength;
          }
          info.jointSource = jointSource;
        }
      }
    }
    return pointerMap;
  }
}

/* NODE-ONLY */
export class NodeEnvironment extends Environment {
  // C++ code will patch in these functions:
  //
  // getBufferAddress
  // allocateFixedMemory
  // freeFixedMemory
  // obtainFixedView
  // copyBytes
  // findSentinel

  isFixed(dv) {
    return dv.buffer instanceof SharedArrayBuffer;
  }

  getAlignmentExtra(align) {
    return (align <= 16) ? 0 : align;
  }

  allocateRelocatableMemory(len, align) {
    const dv = this.createRelocatableBuffer(len, align);
    this.registerMemory(dv);
    return dv;
  }

  freeRelocatableMemory(address, len, align) {
    this.unregisterMemory(address);
  }

  allocateShadowMemory(len, align) {
    return this.createRelocatableBuffer(len, align);
  }

  freeShadowMemory(address, len, align) {
    // nothing needs to happen
  }

  updatePointerAddresses(args) {
    // collect the pointers first
    const map = this.collectPointers(args);
    for (const [ pointer, info ] of map) {
      const { target, jointSource } = info;
      const dv = target[MEMORY];
      let address;
      if (jointSource) {
        // pointer is pointing to buffer with overlapping views
        if (jointSource.address === undefined) {
          const baseAddress = this.getBufferAddress(dv.buffer);
          let allAligned = true;
          // ensure that all the pointers are properly aligned
          for (const [ offset, align ] of Object.entries(jointSource.aligns)) {
            const viewAddress = addLength(baseAddress, offset);
            if (isMisaligned(viewAddress, align)) {
              allAligned = false;
              break;
            }
          }
          if (allAligned) {
            jointSource.address = baseAddress;
          } else {
            // allocate a
            const { startOffset, endOffset } = jointSource;
            const len = endOffset - startOffset;
            const sourceDV = new DataView(dv.buffer, startOffset, len);
            const source = {
              constructor: {
                [ALIGN]: maxAlign,
              },
              [MEMORY]: sourceDV,
              [MEMORY_COPIER]: getMemoryCopier(len),
            };
            const sourceShadow = this.createShadow(source);
            const shadowDV = sourceShadow[MEMORY];
            const shadowAddress = this.getViewAddress(shadowDV);

          }
        }
        address = jointSource.address + dv.byteOffset;
      } else {
        const align = target.constructor[ALIGN];
        address = this.getViewAddress(dv);
        if (isMisaligned(address, align)) {
          // need to shadow the object
          const shadow = this.createShadow(target);
          address = this.getViewAddress(shadow[MEMORY]);
        }
      }
      // update the pointer
      pointer[ADDRESS_UPDATER](address, target.length);
    }
  }

  acquirePointerTargets(args) {
    args[POINTER_VISITOR](acquireTarget, { vivificate: true });
  }

  invokeFactory(thunk) {
    initializeErrorSets();
    const result = thunk.call(this);
    if (typeof(result) === 'string') {
      // an error message
      throwZigError(result);
    }
    // attach __zigar object
    let module = result;
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

  invokeThunk(thunk, args) {
    let err;
    if (args[POINTER_VISITOR]) {
      // create an object where information concerning pointers can be stored
      this.startContext();
      // copy addresses of garbage-collectible objects into memory
      this.updatePointerAddresses(args);
      err = thunk.call(this, args[MEMORY]);
      // create objects that pointers point to
      this.acquirePointerTargets(args);
      // restore the previous context if there's one
      this.endContext();
    } else {
      // don't need to do any of that if there're no pointers
      err = thunk.call(this, args[MEMORY]);
    }

    // errors returned by exported Zig functions are normally written into the
    // argument object and get thrown when we access its retval property (a zig error union)
    // error strings returned by the thunk are due to problems in the thunking process
    // (i.e. bugs in export.zig)
    if (err) {
      throwZigError(err);
    }
    return args.retval;
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
          value[THUNK_REPLACER]?.(replacement);
        } else if (get && !set) {
          // the getter might return a type/class/constuctor
          const child = cls[name];
          if (typeof(child) === 'function') {
            releaseClass(child);
          }
        }
      }
      for (const { value } of Object.values(Object.getOwnPropertyDescriptors(cls.prototype))) {
        if (typeof(value) === 'function') {
          // release thunk of instance function
          value[THUNK_REPLACER]?.(replacement);
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
        for (const child of Object.values(slots)) {
          // deal with pointers in structs
          if (child.hasOwnProperty(POINTER_VISITOR)) {
            releaseObject(child);
          }
        }
        if (obj.hasOwnProperty(POINTER_VISITOR)) {
          // a pointer--release what it's pointing to
          releaseObject(obj[SLOTS][0]);
        } else {
          // force recreation of child objects so they'll use non-shared memory
          obj[SLOTS] = {};
        }
      }
    };
    releaseClass(module);
  }
}
/* NODE-ONLY-END */

/* WASM-ONLY */
export class WebAssemblyEnvironment extends Environment {
  imports = {
    defineStructures: { argType: '', returnType: 'v' },
    allocateFixedMemory: { argType: 'iii', returnType: 'v' },
    freeFixedMemory: { argType: 'iiii' },
    allocateShadowMemory: { argType: 'ii', returnType: 'v' },
    freeShadowMemory: { argType: 'iii' },
    runThunk: { argType: 'iv', returnType: 'v' },
    isRuntimeSafetyActive: { argType: '', returnType: 'b' },
  };
  exports = {
    allocoateRelocatableMemory: { argType: 'ii', returnType: 'v' },
    freeRelocatableMemory: { argType: 'iii' },
    createString: { argType: 'ii', returnType: 'v' },
    createObject: { argType: 'vv', returnType: 's' },
    createView: { argType: 'ii', returnType: 'v' },
    castView: { argType: 'vv', returnType: 'v' },
    readSlot: { argType: 'vi', returnType: 'v' },
    writeSlot: { argType: 'viv' },
    beginDefinition: { returnType: 'v' },
    insertInteger: { argType: 'vsi' },
    insertBoolean: { argType: 'vsb' },
    insertString: { argType: 'vss' },
    insertObject: { argType: 'vsv' },
    beginStructure: { argType: 'v', returnType: 'v' },
    attachMember: { argType: 'vvb' },
    attachMethod: { argType: 'vvb' },
    createTemplate: { argType: 'v' },
    attachTemplate: { argType: 'vvb' },
    finalizeStructure: { argType: 'v' },
    writeToConsole: { argType: 'v' },
    startCall: { argType: 'iv', returnType: 'i' },
    endCall: { argType: 'v', returnType: 'i' },
  };
  nextValueIndex = 1;
  valueTable = { 0: null };
  valueIndices = new Map;
  memory = null;
  /* COMPTIME-ONLY */
  structures = [];
  /* COMPTIME-ONLY-END */
  /* RUNTIME-ONLY */
  fixedBufferList = [];
  fixedBufferInterval = 0;
  /* RUNTIME-ONLY-END */

  constructor() {
    super();
  }

  releaseObjects() {
    if (this.nextValueIndex !== 1) {
      this.nextValueIndex = 1;
      this.valueTable = { 0: null };
      this.valueIndices = new Map();
    }
  }

  getObjectIndex(object) {
    if (object) {
      let index = this.valueIndices.get(object);
      if (index === undefined) {
        index = this.nextValueIndex++;
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
      case 'v':
      case 's': return this.valueTable[arg];
      case 'i': return arg;
      case 'b': return !!arg;
    }
  }

  toWebAssembly(type, arg) {
    switch (type) {
      case 'v':
      case 's': return this.getObjectIndex(arg);
      case 'i': return arg;
      case 'b': return arg ? 1 : 0;
    }
  }

  exportFunction(fn, argType = '', returnType = '') {
    if (!fn) {
      return () => {};
    }
    return (...args) => {
      args = args.map((arg, i) => this.fromWebAssembly(argType.charAt(i), arg));
      const retval = fn.apply(this, args);
      return this.toWebAssembly(returnType, retval);
    };
  }

  importFunction(fn, argType = '', returnType = '') {
    return (...args) => {
      args = args.map((arg, i) => this.toWebAssembly(argType.charAt(i), arg));
      const retval = fn.apply(this, args);
      return this.fromWebAssembly(returnType, retval);
    };
  }

  exportFunctions() {
    const imports = {};
    for (const [ name, { argType, returnType } ] of Object.entries(this.exports)) {
      const fn = this[name];
      imports[`_${name}`] = this.exportFunction(fn, argType, returnType);
    }
    return imports;
  }

  importFunctions(exports) {
    for (const [ name, fn ] of Object.entries(exports)) {
      const info = this.imports[name];
      if (info) {
        const { argType, returnType } = info;
        this[name] = this.importFunction(fn, argType, returnType);
      }
    }
  }

  releaseFunctions() {
    const throwError = function() {
      throw new Error('WebAssembly instance was abandoned');
    };
    for (const { name } of Object.values(this.imports)) {
      if (this[name]) {
        this[name] = throwError;
      }
    }
  }

  async instantiateWebAssembly(source) {
    const env = this.exportFunctions();
    if (source[Symbol.toStringTag] === 'Response') {
      return WebAssembly.instantiateStreaming(source, { env });
    } else {
      const buffer = await source;
      return WebAssembly.instantiate(buffer, { env });
    }
  }

  async loadWebAssembly(source) {
    const { instance } = await this.instantiateWebAssembly(source);
    this.memory = instance.exports.memory;
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

  isFixed(dv) {
    return dv.buffer === this.memory.buffer;
  }

  createBuffer(len, align) {
    return new DataView(new ArrayBuffer(len));
  }

  getViewAddress(dv) {
    const { buffer } = dv;
    let address;
    if (buffer !== this.memory.buffer) {

    } else {
      address = dv.byteOffset();
    }
    return address;
  }

  createFixedBuffer(len, align) {
    const dv = this.allocateFixedMemory(len, align);
    const ref = new WeakRef(dv);
    const address = this.getViewAddress(dv);
    this.fixedBufferList.push({ ref, address, len, align });
    if (!this.fixedBufferInterval) {
      this.fixedBufferInterval = setInterval(() => {
        this.freeUnreferencedBuffers();
        if (this.fixedBufferList.length === 0) {
          clearInterval(this.fixedBufferInterval);
          this.fixedBufferInterval = 0;
        }
      }, 500);
    }
    return dv;
  }

  freeUnreferencedBuffers() {
    const bufferList = this.fixedBufferList;
    for (let i = bufferList.length - 1; i >= 0; i--) {
      const { ref, address, len, align } = bufferList[i];
      if (!ref.deref()) {
        // freeFixedMemory() would throw if the wasm instance was abandoned
        try {
          this.freeFixedMemory(address, len, align);
        } catch (err) {
        }
        bufferList.splice(i, 1);
      }
    }
  }

  obtainFixedView(address, len) {
    const { buffer } = this.memory;
    return new DataView(buffer, address, len);
  }

  createString(address, len) {
    const { buffer } = this.memory;
    const ta = new Uint8Array(buffer, address, len);
    return decodeText(ta);
  }

  startCall(call, args) {
    this.startContext();
    // call context, use by allocSharedMemory and freeSharedMemory
    this.context.call = call;
    if (!args) {
      // can't be 0 since that sets off Zig's runtime safety check
      return 0xaaaaaaaa;
    }
    console.log({ args });
  }

  endCall(call, args) {
    this.endContext();
  }

  /* COMPTIME-ONLY */
  runFactory(options) {
    const {
      omitFunctions = false
    } = options;
    if (omitFunctions) {
      this.attachMethod = () => {};
    }
    const result = this.defineStructures();
    if (result instanceof String) {
      throwZigError(result.valueOf());
    }
    this.fixOverlappingMemory();
    return {
      structures: this.structures,
      runtimeSafety: this.isRuntimeSafetyActive(),
    };
  }

  beginDefinition() {
    return {};
  }

  insertProperty(def, name, value) {
    def[name] = value;
  }

  fixOverlappingMemory() {
    // look for buffers that requires linkage
    const list = [];
    const find = (object) => {
      if (!object) {
        return;
      }
      if (object[MEMORY]) {
        const dv = object[MEMORY];
        const { address } = dv;
        if (address) {
          list.push({ address, length: dv.byteLength, owner: object, replaced: false });
        }
      }
      if (object[SLOTS]) {
        for (const child of Object.values(object[SLOTS])) {
          find(child);
        }
      }
    };
    for (const structure of this.structures) {
      find(structure.instance.template);
      find(structure.static.template);
    }
    // larger memory blocks come first
    list.sort((a, b) => b.length - a.length);
    for (const a of list) {
      for (const b of list) {
        if (a !== b && !a.replaced) {
          if (a.address <= b.address && b.address + b.length <= a.address + a.length) {
            // B is inside A--replace it with a view of A's buffer
            const dv = a.owner[MEMORY];
            const offset = b.address - a.address + dv.byteOffset;
            const newDV = new DataView(dv.buffer, offset, b.length);
            newDV.address = b.address;
            b.owner[MEMORY] = newDV;
            b.replaced = true;
          }
        }
      }
    }
  }

  finalizeStructure(structure) {
    this.structures.push(structure);
  }
  /* COMPTIME-ONLY-END */

  /* RUNTIME-ONLY */
  finalizeStructures(structures) {
    initializeErrorSets();
    for (const structure of structures) {
      for (const target of [ structure.static, structure.instance ]) {
        // first create the actual template using the provided placeholder
        if (target.template) {
          target.template = createTemplate(target.template);
        }
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
      let dv;
      if (placeholder.memory) {
        const { array, offset, length } = placeholder.memory;
        dv = new DataView(array.buffer, offset, length);
      } else {
        const { byteSize } = placeholder.structure;
        dv = new DataView(new ArrayBuffer(byteSize));
      }
      const object = this.castObject(placeholder.structure, dv);
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
    const {
      writeBack = true,
    } = params;
    const zigar = await this.loadWebAssembly(source);
    return zigar;
  }

  invokeThunk(thunk, args) {
    // WASM thunks aren't functions--they're indices into the function table 0
    // wasm-exporter.zig will invoke startCall() with the context address and the args
    // we can't do pointer fix up here since we need the context in order to allocate
    // memory from the WebAssembly allocator; point target acquisition will happen in
    // endCall()
    const err = this.runThunk(thunk, args);

    // errors returned by exported Zig functions are normally written into the
    // argument object and get thrown when we access its retval property (a zig error union)
    // error strings returned by the thunk are due to problems in the thunking process
    // (i.e. bugs in export.zig)
    if (err) {
      throwZigError(err);
    }
    return args.retval;
  }
  /* RUNTIME-ONLY */
}
/* WASM-ONLY-END */

export class CallContext {
  pointerProcessed = new Map();
  memoryList = [];
  shadowMap = [];
}

export function findSortedIndex(array, value, cb) {
  let low = 0;
  let high = array.length;
  if (high === 0) {
    return 0;
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const value2 = cb(array[mid]);
    if (value2 <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return high;
}

function findMemoryIndex(array, address) {
  return findSortedIndex(array, address, m => m.address);
}

function addLength(address, len) {
  return address + ((typeof(address) === 'bigint') ? BigInt(len) : len);
}

export function isMisaligned(address, align) {
  if (typeof(address) === 'bigint') {
    address = Number(address & 0xFFFFFFFFn);
  }
  const mask = align - 1;
  return (address & mask) !== 0;
}

export function getAlignedAddress(address, align) {
  let mask;
  if (typeof(address) === 'bigint') {
    align = BigInt(align);
    mask = ~(align - 1n);
  } else {
    mask = ~(align - 1);
  }
  return (address & mask) + align;
}