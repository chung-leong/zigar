import { Environment } from './environment.js';
import { Exit, ZigError } from './error.js';
import { getCopyFunction, getMemoryCopier } from './memory.js';
import { ALIGN, ATTRIBUTES, COPIER, FIXED, MEMORY, POINTER_VISITOR } from './symbol.js';
import { decodeText } from './text.js';

export class WebAssemblyEnvironment extends Environment {
  imports = {
    getFactoryThunk: { argType: '', returnType: 'i' },
    allocateExternMemory: { argType: 'ii', returnType: 'i' },
    freeExternMemory: { argType: 'iii' },
    allocateShadowMemory: { argType: 'cii', returnType: 'v' },
    freeShadowMemory: { argType: 'ciii' },
    runThunk: { argType: 'iv', returnType: 'v' },
    isRuntimeSafetyActive: { argType: '', returnType: 'b' },
    flushStdout: { argType: '', returnType: '' },
  };
  exports = {
    allocateHostMemory: { argType: 'ii', returnType: 'v' },
    freeHostMemory: { argType: 'iii' },
    captureString: { argType: 'ii', returnType: 'v' },
    captureView: { argType: 'iib', returnType: 'v' },
    castView: { argType: 'iibv', returnType: 'v' },
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
    startCall: { argType: 'iv', returnType: 'i' },
    endCall: { argType: 'iv', returnType: 'i' },
  };
  nextValueIndex = 1;
  valueTable = { 0: null };
  valueIndices = new Map;
  memory = null;
  initPromise = null;
  customWASI = null;
  hasCodeSource = false;
  // WASM is always little endian
  littleEndian = true;

  async init(wasi) {
    if (wasi && this.hasCodeSource) {
      throw new Error('Cannot set WASI interface after compilation has already begun (consider disabling topLevelAwait)');
    }
    this.customWASI = wasi;
    await this.initPromise;
  }

  allocateHostMemory(len, align) {
    // allocate memory in both JavaScript and WASM space
    const constructor = { [ALIGN]: align };
    const copier = getMemoryCopier(len);
    const dv = this.allocateRelocMemory(len, align);
    const shadowDV = this.allocateShadowMemory(len, align);
    // create a shadow for the relocatable memory
    const object = { constructor, [MEMORY]: dv, [COPIER]: copier };
    const shadow = { constructor, [MEMORY]: shadowDV, [COPIER]: copier };
    shadow[ATTRIBUTES] = { address: this.getViewAddress(shadowDV), len, align };
    this.addShadow(shadow, object, align);
    return shadowDV;
  }

  freeHostMemory(address, len, align) {
    const dv = this.findMemory(address, len, 1);
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

  obtainExternView(address, len) {
    const { buffer } = this.memory;
    if (!buffer[FIXED]) {
      buffer[FIXED] = { address: 0, len: buffer.byteLength };
    }
    return this.obtainView(buffer, address, len);
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

  captureString(address, len) {
    const { buffer } = this.memory;
    const ta = new Uint8Array(buffer, address, len);
    return decodeText(ta);
  }

  getTargetAddress(target, cluster) {
    const dv = target[MEMORY];
    if (dv[FIXED]) {
      return this.getViewAddress(dv);
    } else if (dv.byteLength === 0) {
      // it's a null pointer/empty slice
      return 0;
    }
    // relocatable buffers always need shadowing
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
    const res = await source;
    this.hasCodeSource = true;
    const imports = {
      env: this.exportFunctions(),
      wasi_snapshot_preview1: this.getWASIImport(),
    };
    if (res[Symbol.toStringTag] === 'Response') {
      return WebAssembly.instantiateStreaming(res, imports);
    } else {
      return WebAssembly.instantiate(res, imports);
    }
  }

  loadModule(source) {
    return this.initPromise = (async () => {
      const { instance } = await this.instantiateWebAssembly(source);
      const { memory, _initialize } = instance.exports;
      this.importFunctions(instance.exports);
      this.trackInstance(instance);
      this.customWASI?.initialize?.(instance);
      this.runtimeSafety = this.isRuntimeSafetyActive();
      this.memory = memory;
      // run the init function if there one
      /* c8 ignore next */
      _initialize?.();
    })();
  }

  trackInstance(instance) {
    // use WeakRef to detect whether web-assembly instance has been gc'ed
    const ref = new WeakRef(instance);
    Object.defineProperty(this, 'released', { get: () => !ref.deref(), enumerable: true });
  }

  linkVariables(writeBack) {
    // linkage occurs when WASM compilation is complete and functions have been imported
    // nothing needs to happen when WASM is not used
    if (this.initPromise) {
      this.initPromise = this.initPromise.then(() => super.linkVariables(writeBack));
    }
  }

  /* COMPTIME-ONLY */
  beginDefinition() {
    return {};
  }

  insertProperty(def, name, value) {
    def[name] = value;
  }
  /* COMPTIME-ONLY-END */

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
    if (args[POINTER_VISITOR]) {
      this.updatePointerAddresses(args);
    }
    // return address of shadow for argumnet struct
    const address = this.getShadowAddress(args);
    this.updateShadows();
    return address;
  }

  endCall(call, args) {
    this.updateShadowTargets();
    if (args[POINTER_VISITOR]) {
      this.updatePointerTargets(args);
    }
    this.releaseShadows();
    // restore the previous context if there's one
    this.endContext();
    if (!this.context && this.flushConsole) {
      this.flushStdout();
      this.flushConsole();
    }
  }

  async runThunk(thunkId, args) {
    // wait for compilation
    await this.initPromise;
    // invoke runThunk() from WASM code
    return this.runThunk(thunkId, args);
  }

  invokeThunk(thunkId, args) {
    try {
      // wasm-exporter.zig will invoke startCall() with the context address and the args
      // we can't do pointer fix up here since we need the context in order to allocate
      // memory from the WebAssembly allocator; pointer target acquisition will happen in
      // endCall()
      const unexpected = this.runThunk(thunkId, args);
      // errors returned by exported Zig functions are normally written into the
      // argument object and get thrown when we access its retval property (a zig error union)
      // error strings returned by the thunk are due to problems in the thunking process
      // (i.e. bugs in export.zig)
      if (unexpected) {
        if (unexpected[Symbol.toStringTag] === 'Promise') {
          // getting a promise, WASM is not yet ready
          // wait for fulfillment, then either return result or throw
          return unexpected.then((unexpected) => {
            if (unexpected) {
              this.handleError(unexpected);
            }
            return args.retval;
          }, (err) => {
            this.handleError(err);
          })
        } else {
          throw unexpected;
        }
      }
      return args.retval;
    } catch (err) {
      this.handleError(err);
    }
  }

  handleError(unexpected) {
    if (typeof(unexpected) === 'string') {
      // an error string
      throw new ZigError(unexpected);
    } else if (unexpected instanceof Exit && unexpected.code === 0) {
      // do nothing when exit code is 0
      return;
    } else {
      throw unexpected;
    }
  }

  getWASIImport() {
    if (this.customWASI) {
      return this.customWASI.wasiImport;
    } else {
      const ENOSYS = 38;
      const ENOBADF = 8;
      const noImpl = () => ENOSYS;
      return {
        args_get: noImpl,
        args_sizes_get: noImpl,
        clock_res_get: noImpl,
        clock_time_get: noImpl,
        environ_get: noImpl,
        environ_sizes_get: noImpl,
        fd_advise: noImpl,
        fd_allocate: noImpl,
        fd_close: noImpl,
        fd_datasync: noImpl,
        fd_pread: noImpl,
        fd_pwrite: noImpl,
        fd_read: noImpl,
        fd_readdir: noImpl,
        fd_renumber: noImpl,
        fd_seek: noImpl,
        fd_sync: noImpl,
        fd_tell: noImpl,
        fd_write: (fd, iovs_ptr, iovs_count, written_ptr) => {
          if (fd === 1 || fd === 2) {
            const dv = new DataView(this.memory.buffer);
            let written = 0;
            for (let i = 0, p = iovs_ptr; i < iovs_count; i++, p += 8) {
              const buf_ptr = dv.getUint32(p, true);
              const buf_len = dv.getUint32(p + 4, true);
              if (buf_len > 0) {
                const buf = new DataView(this.memory.buffer, buf_ptr, buf_len);
                this.writeToConsole(buf);
                written += buf_len;
              }
            }
            dv.setUint32(written_ptr, written, true);
            return 0;
          } else {
            return ENOSYS;
          }
        },
        fd_fdstat_get: noImpl,
        fd_fdstat_set_flags: noImpl,
        fd_fdstat_set_rights: noImpl,
        fd_filestat_get: noImpl,
        fd_filestat_set_size: noImpl,
        fd_filestat_set_times: noImpl,
        fd_prestat_get: () => ENOBADF,
        fd_prestat_dir_name: noImpl,
        path_create_directory: noImpl,
        path_filestat_get: noImpl,
        path_filestat_set_times: noImpl,
        path_link: noImpl,
        path_open: noImpl,
        path_readlink: noImpl,
        path_remove_directory: noImpl,
        path_rename: noImpl,
        path_symlink: noImpl,
        path_unlink_file: noImpl,
        poll_oneoff: noImpl,
        proc_exit: (code) => {
          throw new Exit(code);
        },
        random_get: (buf, buf_len) => {
          const dv = new DataView(this.memory.buffer, buf, buf_len);
          for (let i = 0; i < buf_len; i++) {
            dv.setUint8(i, Math.floor(256 * Math.random()));
          }
          return 0;
        },
        sched_yield: noImpl,
        sock_accept: noImpl,
        sock_recv: noImpl,
        sock_send: noImpl,
        sock_shutdown: noImpl,
      };
    }
  }
}
