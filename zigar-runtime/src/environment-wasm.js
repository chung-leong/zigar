import { Environment } from './environment.js';
import { decodeText } from './text.js';
import { throwZigError } from './error.js';
import { getCopyFunction, getMemoryCopier, restoreMemory } from './memory.js';
import { ALIGN, MEMORY, MEMORY_COPIER, POINTER_VISITOR, SHADOW_ATTRIBUTES } from './symbol.js';

export class WebAssemblyEnvironment extends Environment {
  imports = {
    defineStructures: { argType: '', returnType: 'v' },
    allocateExternMemory: { argType: 'ii', returnType: 'v' },
    freeExternMemory: { argType: 'iii' },
    allocateShadowMemory: { argType: 'cii', returnType: 'v' },
    freeShadowMemory: { argType: 'ciii' },
    runThunk: { argType: 'iv', returnType: 'v' },
    isRuntimeSafetyActive: { argType: '', returnType: 'b' },
  };
  exports = {
    allocateRelocatableMemory: { argType: 'ii', returnType: 'v' },
    freeRelocatableMemory: { argType: 'iii' },
    createString: { argType: 'ii', returnType: 'v' },
    createView: { argType: 'iib', returnType: 'v' },
    castView: { argType: 'vvb', returnType: 'v' },
    readSlot: { argType: 'vi', returnType: 'v' },
    writeSlot: { argType: 'viv' },
    getViewAddress: { argType: 'v', returnType: 'i' },
    beginDefinition: { returnType: 'v' },
    insertInteger: { argType: 'vsi', alias: 'insertProperty' },
    insertBoolean: { argType: 'vsb', alias: 'insertProperty' },
    insertString: { argType: 'vss', alias: 'insertProperty' },
    insertObject: { argType: 'vsv', alias: 'insertProperty' },
    beginStructure: { argType: 'v', returnType: 'v' },
    attachMember: { argType: 'vvb' },
    attachMethod: { argType: 'vvb' },
    createTemplate: { argType: 'v', returnType: 'v' },
    attachTemplate: { argType: 'vvb' },
    finalizeShape: { argType: 'v' },
    endStructure: { argType: 'v' },
    writeToConsole: { argType: 'v' },
    startCall: { argType: 'iv', returnType: 'i' },
    endCall: { argType: 'iv', returnType: 'i' },
  };
  nextValueIndex = 1;
  valueTable = { 0: null };
  valueIndices = new Map;
  memory = null;
  // WASM is always little endian
  littleEndian = true;

  allocateRelocatableMemory(len, align) {
    // allocate memory in both JS and WASM space
    const constructor = { [ALIGN]: align };
    const copier = getMemoryCopier(len);
    const dv = this.createBuffer(len);
    const shadowDV = this.allocateShadowMemory(len, align);
    // create a shadow for the relocatable memory
    const object = { constructor, [MEMORY]: dv, [MEMORY_COPIER]: copier };
    const shadow = { constructor, [MEMORY]: shadowDV, [MEMORY_COPIER]: copier };
    shadow[SHADOW_ATTRIBUTES] = { address: this.getViewAddress(shadowDV), len, align };
    this.addShadow(shadow, object);
    return shadowDV;
  }

  freeRelocatableMemory(address, len, align) {
    const dv = this.findMemory(address, len);
    this.removeShadow(dv);
    this.unregisterMemory(address);
    this.freeShadowMemory(address, len, align);
  }

  getBufferAddress(buffer) {
    /* DEV-TEST */
    if (buffer !== this.memory.buffer) {
      throw new Error('Cannot obtain address of relocatable buffer');
    }
    /* DEV-TEST-END */
    return 0;
  }

  allocateFixedMemory(len, align) {
    if (len === 0) {
      return this.emptyView;
    }
    const address = this.allocateExternMemory(len, align);
    const dv = new DataView(buffer, address, len);
    dv[ALIGN] = align;
    return dv;
  }

  freeFixedMemory(address, len, align) {
    if (!len === 0) {
      return;
    }
    this.freeExternMemory(address, len, align);
  }

  obtainFixedView(address, len) {
    if (len === 0) {
      return this.emptyView;
    }
    const { memory } = this;
    const dv = new DataView(memory.buffer, address, len);
    dv[MEMORY] = { memory, address, len };
    return dv;
  }

  releaseFixedView(dv) {
    const buffer = dv.buffer;
    const address = buffer.byteOffset;
    const len = dv.byteLength;
    const align = dv[ALIGN];
    if (align !== undefined) {
      this.freeFixedMemory(address, len, align);
    }
  }

  inFixedMemory(object) {
    // reconnect any detached buffer before checking
    restoreMemory.call(object);
    return object[MEMORY].buffer === this.memory.buffer;
  }

  copyBytes(dst, address, len) {
    const { memory } = this;
    const src = new DataView(memory.buffer, address, len);
    const copy = getCopyFunction(len);
    copy(dst, src);
  }

  findSentinel(address, bytes) {
    const { memory } = this;
    const len = bytes.byteLength;
    const end = memory.buffer.byteLength - len + 1;
    for (let i = address; i < end; i += len) {
      const dv = new DataView(memory.buffer, i, len);
      let match = true;
      for (let j = 0; j < len; j++) {
        const a = dv.getUint8(j);
        const b = bytes.getUint8(j);
        if (a !== b) {
          match = false;
          break;
        }
      }
      if (match) {
        return (i - address) / len;
      }
    }
  }

  createString(address, len) {
    const { buffer } = this.memory;
    const ta = new Uint8Array(buffer, address, len);
    return decodeText(ta);
  }

  getTargetAddress(target, cluster) {
    if (this.inFixedMemory(target)) {
      return this.getViewAddress(target[MEMORY]);
    }
    if (target[MEMORY].byteLength === 0) {
      // it's a null pointer/empty slice
      return 0;
    }
    // relocatable buffers always need shadowing
    return false;
  }

  clearExchangeTable() {
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
    let needCallContext = false;
    if (argType.startsWith('c')) {
      needCallContext = true;
      argType = argType.slice(1);
    }
    return (...args) => {
      args = args.map((arg, i) => this.toWebAssembly(argType.charAt(i), arg));
      if (needCallContext) {
        args = [ this.context.call, ...args ];
      }
      const retval = fn.apply(this, args);
      return this.fromWebAssembly(returnType, retval);
    };
  }

  exportFunctions() {
    const imports = {};
    for (const [ name, { argType, returnType, alias } ] of Object.entries(this.exports)) {
      const fn = this[alias ?? name];
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

  async instantiateWebAssembly(source) {
    const env = this.exportFunctions();
    if (source[Symbol.toStringTag] === 'Response') {
      return WebAssembly.instantiateStreaming(source, { env });
    } else {
      const buffer = await source;
      return WebAssembly.instantiate(buffer, { env });
    }
  }

  async loadModule(source) {
    return this.initPromise = (async () => {
      const { instance } = await this.instantiateWebAssembly(source);
      this.memory = instance.exports.memory;
      this.importFunctions(instance.exports);
      this.trackInstance(instance);
      this.runtimeSafety = this.isRuntimeSafetyActive();
    })();
  }

  trackInstance(instance) {
    // use WeakRef to detect whether web-assembly instance has been gc'ed
    const ref = new WeakRef(instance);
    Object.defineProperty(this, 'released', { get: () => !ref.deref(), enumerable: true });
  }

  linkVariables(writeBack) {
    // linkage occurs when WASM compilation is complete and functions have been imported
    this.initPromise = this.initPromise.then(() => super.linkVariables(writeBack));
  }

  /* COMPTIME-ONLY */
  beginDefinition() {
    return {};
  }

  insertProperty(def, name, value) {
    def[name] = value;
  }
  /* COMPTIME-ONLY-END */

  /* RUNTIME-ONLY */
  getMemoryOffset(address) {
    // WASM address space starts at 0
    return address;
  }

  recreateAddress(reloc) {
    return reloc;
  }

  startCall(call, args) {
    this.startContext();
    // call context, used by allocateShadowMemory and freeShadowMemory
    this.context.call = call;
    if (args) {
      if (args[POINTER_VISITOR]) {
        this.updatePointerAddresses(args);
      }
      // return address of shadow for argumnet struct
      const address = this.getShadowAddress(args);
      this.updateShadows();
      return address;
    }
    // can't be 0 since that sets off Zig's runtime safety check
    return 0xaaaaaaaa;
  }

  endCall(call, args) {
    if (args) {
      this.updateShadowTargets();
      if (args[POINTER_VISITOR]) {
        this.acquirePointerTargets(args);
      }
      this.releaseShadows();
    }
    // restore the previous context if there's one
    this.endContext();
    if (!this.context) {
      this.flushConsole();
    }
  }

  invokeThunk(thunkId, args) {
    // wasm-exporter.zig will invoke startCall() with the context address and the args
    // we can't do pointer fix up here since we need the context in order to allocate
    // memory from the WebAssembly allocator; pointer target acquisition will happen in
    // endCall()
    const err = this.runThunk(thunkId, args);
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
