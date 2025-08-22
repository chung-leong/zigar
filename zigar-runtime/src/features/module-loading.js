import { PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { decodeText, defineProperty, defineValue, empty, isPromise } from '../utils.js';

export default mixin({
  init() {
    this.abandoned = false;
    this.destructors = [];
    if (process.env.TARGET === 'wasm') {
      this.nextValueIndex = 1;
      this.valueMap = new Map();
      this.valueIndices = new Map();
      this.options = null;
      this.executable = null;
      this.memory = null;
      this.table = null;
      this.initialTableLength = 0;
      this.exportedFunctions = null;
      this.customWASI = null;
    }
  },
  abandonModule() {
    if (!this.abandoned) {
      for (const destructor of this.destructors.reverse()) {
        destructor();
      }
      this.abandoned = true;
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      initialize: { argType: '' },
    },
    exports: {
      displayPanic: { argType: 'ii' },
    },

    async initialize(wasi) {
      this.setCustomWASI?.(wasi);
      await this.initPromise;
    },
    getObjectIndex(object) {
      if (object != null) {
        let index = this.valueIndices.get(object);
        if (index === undefined) {
          index = this.nextValueIndex++;
          this.valueIndices.set(object, index);
          this.valueMap.set(index, object);
        }
        return index;
      } else {
        return 0;
      }
    },
    fromWebAssembly(type, arg) {
      switch (type) {
        case 'v':
        case 's': return this.valueMap.get(arg);
        case 'i': return arg;
        case 'b': return !!arg;
      }
    },
    toWebAssembly(type, arg) {
      switch (type) {
        case 'v':
        case 's': return this.getObjectIndex(arg);
        case 'i': return arg;
        case 'b': return arg ? 1 : 0;
      }
    },
    exportFunction(fn, argType = '', returnType = '', name) {
      if (!fn) {
        return () => {};
      }
      return (...args) => {
        args = args.map((arg, i) => this.fromWebAssembly(argType.charAt(i), arg));
        const retval = fn.apply(this, args);
        const retval2 = this.toWebAssembly(returnType, retval);
        return retval2;
      };
    },
    importFunction(fn, argType = '', returnType = '') {
      return (...args) => {
        args = args.map((arg, i) => this.toWebAssembly(argType.charAt(i), arg));
        const retval = fn.apply(this, args);
        return this.fromWebAssembly(returnType, retval);
      };
    },
    exportFunctions() {
      const imports = {};
      for (const [ name, { argType, returnType, alias } ] of Object.entries(this.exports)) {
        const fn = this[alias ?? name];
        if (fn) {
          imports[`_${name}`] = this.exportFunction(fn, argType, returnType, name);
        }
      }
      return imports;
    },
    importFunctions(exports) {
      for (const [ name, { argType, returnType } ] of Object.entries(this.imports)) {
        const fn = exports[name];
        if (fn) {
          defineProperty(this, name, defineValue(this.importFunction(fn, argType, returnType)));
          this.destructors.push(() => this[name] = throwError);
        }
      }
    },
    async instantiateWebAssembly(source, options) {
      const {
        memoryInitial,
        memoryMax,
        tableInitial,
        multithreaded,
      } = this.options = options;
      const res = await source;
      const suffix = (res[Symbol.toStringTag] === 'Response') ? /* c8 ignore next */ 'Streaming' : '';
      const w = WebAssembly;
      const f = w['compile' + suffix];
      const executable = this.executable = await f(res);
      const functions = this.exportFunctions();
      const env = {}, wasi = {}, wasiPreview = {};
      const exports = this.exportedModules = { env, wasi, wasi_snapshot_preview1: wasiPreview };
      for (const { module, name, kind } of w.Module.imports(executable)) {
        if (kind === 'function') {
          if (module === 'env') {
            env[name] = functions[name] ?? /* c8 ignore next */ empty;
          } else if (module === 'wasi_snapshot_preview1') {
            wasiPreview[name] = this.getWASIHandler(name);
          } else if (module === 'wasi') {
            wasi[name] = this.getThreadHandler?.(name) ?? /* c8 ignore next */ empty;
          }
        }
      }
      this.memory = env.memory = new w.Memory({
        initial: memoryInitial,
        maximum: memoryMax,
        shared: multithreaded,
      });
      this.table = env.__indirect_function_table = new w.Table({
        initial: tableInitial,
        element: 'anyfunc',
        shared: multithreaded,
      });
      this.initialTableLength = tableInitial;
      return w.instantiate(executable, exports);
    },
    loadModule(source, options) {
      return this.initPromise = (async () => {
        this.customWASI = await this.triggerEvent('wasi', {});
        const instance = await this.instantiateWebAssembly(source, options);
        const { exports } = instance;
        this.importFunctions(exports);
        if (this.customWASI) {
          // use a proxy to attach the memory object to the list of exports
          const exportsPlusMemory = { ...exports, memory: this.memory };
          const instanceProxy = new Proxy(instance, {
            get(inst, name) {
              return (name === 'exports') ? exportsPlusMemory : /* c8 ignore next */ inst[name];
            }
          });
          this.customWASI.initialize?.(instanceProxy);
        }
        this.initialize();
      })();
    },
    getWASIHandler(name) {
      return this.getBuiltinHandler?.(name)
          ?? this.customWASI?.wasiImport?.[name]
          ?? (() => {
            console.error(`Not implemented: ${name}`);
            return PosixError.ENOTSUP;
          });
    },
    displayPanic(address, len) {
      const array = new Uint8Array(this.memory.buffer, address, len);
      const msg = decodeText(array);
      console.error(`Zig panic: ${msg}`);
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      loadModule: {},
    },

    exportFunctions() {
      const imports = {};
      for (const [ name, attributes ] of Object.entries(this.exports)) {
        const { 
          async: canReturnPromise = false,
        } = attributes;
        let fn = this[name];
        if (fn) {
          if (canReturnPromise) {
            fn = this.addPromiseHandling(fn);
          }
          imports[name] = fn.bind(this);
        }
      }
      return imports;
    },
    addPromiseHandling(fn) {
      const futexIndex = fn.length - 1;
      return function(...args) {
        const futexHandle = args[futexIndex];
        const canWait = !!futexHandle;
        // replace futexHandle with canWait in the argument list
        args[futexIndex] = canWait;
        const result = fn.call(this, ...args);
        if (canWait) {
          if (isPromise(result)) {
            result.then(result => this.finalizeAsyncCall(futexHandle, result));
          } else {
            this.finalizeAsyncCall(futexHandle, result);
          }
        } else {
          return result;
        }
        return PosixError.NONE;
      }
    },
    importFunctions(exports) {
      for (const [ name ] of Object.entries(this.imports)) {
        const fn = exports[name];
        if (fn) {
          defineProperty(this, name, defineValue(fn));
          this.destructors.push(() => this[name] = throwError);
        }
      }
    },
  /* c8 ignore next */
  } : undefined),
  /* c8 ignore start */
  ...(process.env.DEV ? {
    diagModuleLoading() {
      const targetSpecific = (process.env.TARGET === 'wasm') ? [
        `Value count: ${this.valueMap.size}`,
        `WASM memory: ${this.memory?.buffer?.byteLength}`,
        `WASM table: ${this.table?.length}`,
      ] : [];
      this.showDiagnostics('Module loading', [
        `Abandoned: ${this.abandoned}`,
        ...targetSpecific,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
});

const throwError = () => { throw new Error(`Module was abandoned`) };
